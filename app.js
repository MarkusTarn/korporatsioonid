/* ==========================================================================
   Encyclopaedia Corporationum — Academic Modern — App
   ========================================================================== */

(function () {
    'use strict';

    /* ==================================================================
       Configuration
    ================================================================== */
    var GOOGLE_MAPS_API_KEY = '';

    /* ==================================================================
       Constants
    ================================================================== */
    var COLOR_MAP = {
        'white': '#ffffff',
        'black': '#000000',
        'red darken-3': '#c62828',
        'red darken-4': '#b71c1c',
        'green darken-3': '#2e7d32',
        'green darken-4': '#1b5e20',
        'blue': '#2196f3',
        'blue darken-3': '#1565c0',
        'purple': '#9c27b0',
        'purple lighten-1': '#ab47bc',
        'purple darken-3': '#6a1b9a',
        'indigo': '#3f51b5',
        'orange lighten-5': '#fff3e0',
        'orange accent-1': '#ffd180',
        'yellow': '#ffeb3b',
        'yellow accent-4': '#ffd600',
        'deep-purple lighten-4': '#d1c4e9',
        'teal darken-2': '#00796b',
        'pink lighten-1': '#ec407a'
    };

    var ESTONIAN_MONTHS = [
        'jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni',
        'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'
    ];

    /* Test mode: field mappings for question generation */
    var ATTRIBUTE_MAP = [
        {
            key: 'asutatud',
            label: 'Asutatud',
            getValue: function (org) { return org.foundedFormatted || ''; }
        },
        {
            key: 'värvid',
            label: 'Värvid',
            getValue: function (org) { return (org.palette && org.palette.text) ? org.palette.text : ''; }
        },
        {
            key: 'liige',
            label: 'Liige',
            getValue: function (org) { return org.member || ''; }
        },
        {
            key: 'asukoht tallinnas',
            label: 'Asukoht Tallinnas',
            getValue: function (org) {
                return (org.location && org.location.tallinn && org.location.tallinn.address) ? org.location.tallinn.address : '';
            }
        },
        {
            key: 'asukoht tartus',
            label: 'Asukoht Tartus',
            getValue: function (org) {
                return (org.location && org.location.tartu && org.location.tartu.address) ? org.location.tartu.address : '';
            }
        },
        {
            key: 'lipukiri',
            label: 'Lipukiri',
            getValue: function (org) { return org.motto || ''; }
        }
    ];

    function generateQuestionText(orgName, attrKey) {
        switch (attrKey) {
            case 'asutatud': return 'Millal asutati ' + orgName + '?';
            case 'värvid': return 'Mis on ' + orgName + ' värvid?';
            case 'liige': return 'Mis on ' + orgName + ' liikme nimetus?';
            case 'asukoht tallinnas': return 'Kus asub ' + orgName + ' Tallinnas?';
            case 'asukoht tartus': return 'Kus asub ' + orgName + ' Tartus?';
            case 'lipukiri': return 'Mis on ' + orgName + ' lipukiri?';
            default: return '';
        }
    }

    /* ==================================================================
       Analytics
    ================================================================== */
    function track(eventName, params) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, params || {});
        }
    }

    function trackPageView(view) {
        if (typeof gtag !== 'function') return;

        var pagePath = view === 'list' ? '/' : '/' + view;
        var pageLocation = location.origin + location.pathname + (view === 'list' ? '' : '#' + VIEW_HASH[view]);

        gtag('event', 'page_view', {
            page_title: 'Encyclopaedia Corporationum - ' + view,
            page_path: pagePath,
            page_location: pageLocation
        });
    }

    /* ==================================================================
       Utilities
    ================================================================== */
    function resolveColor(name) {
        if (!name || name === '-') return null;
        return COLOR_MAP[name] || null;
    }

    function parseDate(str) {
        if (!str || str === '-') return null;
        var parts = str.split('/');
        if (parts.length !== 3) return null;
        var month = parseInt(parts[0], 10);
        var day = parseInt(parts[1], 10);
        var year = parseInt(parts[2], 10);
        if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
        return new Date(year, month - 1, day);
    }

    function formatDateEstonian(date) {
        if (!date) return '';
        return date.getDate() + '. ' + ESTONIAN_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
    }

    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function norm(str) {
        if (!str) return '';
        return String(str).toLowerCase().trim();
    }

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = a[i];
            a[i] = a[j];
            a[j] = temp;
        }
        return a;
    }

    /* ==================================================================
       Data Normalization
    ================================================================== */
    function normalizeOrg(raw) {
        var org = Object.assign({}, raw);
        org.foundedDate = parseDate(org.founded);
        org.foundedFormatted = formatDateEstonian(org.foundedDate);

        if (org.location) {
            ['tartu', 'tallinn'].forEach(function (city) {
                if (org.location[city]) {
                    org.location[city].lat = parseFloat(org.location[city].lat) || 0;
                    org.location[city].long = parseFloat(org.location[city].long) || 0;
                }
            });
        } else {
            org.location = {};
        }

        if (org.member === '-') org.member = '';
        if (org.motto === '-') org.motto = '';
        if (org.palette && org.palette.text === '-') org.palette.text = '';

        return org;
    }

    var orgs = [];
    if (typeof data !== 'undefined' && Array.isArray(data)) {
        orgs = data.map(normalizeOrg);
        orgs.sort(function (a, b) {
            if (!a.foundedDate && !b.foundedDate) return 0;
            if (!a.foundedDate) return 1;
            if (!b.foundedDate) return -1;
            return a.foundedDate - b.foundedDate;
        });
    }

    /* ==================================================================
       State
    ================================================================== */
    var state = {
        genderFilter: 'all',
        cityFilter: 'all',
        typeFilter: 'all',  // 'all', 'corp', 'selts'
        searchTerm: '',
        activeView: 'list',
        // Map
        mapLoaded: false,
        mapReady: false,
        mapCity: 'tartu',
        map: null,
        markers: [],
        infoWindow: null,
        // Practice
        practiceDeck: [],
        practiceIndex: 0,
        practiceRevealed: false,
        practiceInitialized: false,
        // Test
        testQuestions: [],
        testIndex: 0,
        testRevealed: false,
        testInitialized: false
    };

    /* ==================================================================
       List View — Filtering
    ================================================================== */
    function matchesSearch(org, term) {
        if (!term) return true;
        var t = norm(term);
        if (!t) return true;
        if (norm(org.name).indexOf(t) !== -1) return true;
        if (norm(org.founded).indexOf(t) !== -1) return true;
        if (org.palette && norm(org.palette.text).indexOf(t) !== -1) return true;
        if (norm(org.member).indexOf(t) !== -1) return true;
        if (norm(org.url).indexOf(t) !== -1) return true;
        return false;
    }

    function filterOrgs() {
        return orgs.filter(function (org) {
            // Type filter
            if (state.typeFilter === 'corp' && !org.corp) return false;
            if (state.typeFilter === 'selts' && org.corp) return false;

            // Gender filter
            if (state.genderFilter === 'female' && org.sex !== 'female') return false;
            if (state.genderFilter === 'male' && org.sex !== 'male') return false;
            if (state.genderFilter !== 'all' && org.sex === 'uni') return false;

            // City filter
            if (state.cityFilter === 'tallinn' && (!org.location || !org.location.tallinn)) return false;
            if (state.cityFilter === 'tartu' && (!org.location || !org.location.tartu)) return false;

            if (!matchesSearch(org, state.searchTerm)) return false;
            return true;
        });
    }

    /* ==================================================================
       List View — Rendering
    ================================================================== */
    function sexLabel(sex) {
        if (sex === 'female') return 'naised';
        if (sex === 'male') return 'mehed';
        if (sex === 'uni') return 'segaorganisatsioon';
        return '';
    }

    function orgTypeLabel(org) {
        var prefix = '';
        if (org.sex === 'male') prefix = 'Mees';
        else if (org.sex === 'female') prefix = 'Nais';
        else if (org.sex === 'uni') prefix = 'Sega';
        var type = org.corp ? 'korporatsioon' : 'selts';
        return prefix + type;
    }

    function buildCard(org) {
        var topColor = resolveColor(org.palette ? org.palette.top : '');
        var midColor = resolveColor(org.palette ? org.palette.middle : '');
        var botColor = resolveColor(org.palette ? org.palette.bottom : '');

        var h = '<article class="org-card">';

        h += '<div class="org-card__header">';
        h += '<img class="org-card__crest" src="../icons/' + esc(org.slug) + '.svg" alt="' + esc(org.name) + ' vapp" loading="lazy" onerror="this.style.display=\'none\'">';
        h += '<div class="org-card__header-text">';
        h += '<div class="org-card__badge-row"><span class="org-card__type-badge">' + esc(orgTypeLabel(org)) + '</span></div>';
        h += '<h2 class="org-card__name">' + esc(org.name) + '</h2>';
        if (org.foundedFormatted) {
            h += '<p class="org-card__date">' + esc(org.foundedFormatted) + '</p>';
        }
        h += '</div></div>';

        h += '<div class="org-card__divider"></div>';
        h += '<div class="org-card__body">';

        var colorText = (org.palette && org.palette.text) ? org.palette.text : '–';
        h += '<div class="org-card__detail"><span class="org-card__label">Värvid: </span><span class="org-card__palette-text">' + esc(colorText) + '</span></div>';

        var memberText = org.member || '–';
        h += '<div class="org-card__detail"><span class="org-card__label">Liige: </span>' + esc(memberText) + '</div>';
        if (org.location && org.location.tartu) {
            h += '<div class="org-card__detail"><span class="org-card__label">Tartu: </span>' + esc(org.location.tartu.address) + '</div>';
        }
        if (org.location && org.location.tallinn) {
            h += '<div class="org-card__detail"><span class="org-card__label">Tallinn: </span>' + esc(org.location.tallinn.address) + '</div>';
        }

        if (org.url && org.url !== '-') {
            var displayUrl = org.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            h += '<div class="org-card__detail"><span class="org-card__label">Veeb: </span><a class="org-card__link" href="' + esc(org.url) + '" target="_blank" rel="noopener noreferrer">' + esc(displayUrl) + '</a></div>';
        }

        if (org.motto) {
            h += '<div class="org-card__detail org-card__detail--full"><p class="org-card__motto">' + esc(org.motto) + '</p></div>';
        }

        h += '</div></article>';
        return h;
    }

    var listContainer = document.getElementById('org-list');
    var countEl = document.getElementById('org-count');

    function renderList() {
        var filtered = filterOrgs();
        countEl.textContent = filtered.length + ' organisatsiooni';

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            html += buildCard(filtered[i]);
        }
        listContainer.innerHTML = html;

        var cards = listContainer.querySelectorAll('.org-card');
        for (var j = 0; j < cards.length; j++) {
            (function (card, idx) {
                requestAnimationFrame(function () {
                    setTimeout(function () { card.classList.add('visible'); }, idx * 30);
                });
            })(cards[j], j);
        }
    }

    /* ==================================================================
       Shared Filters (used by List, Practice, Test)
    ================================================================== */
    var allFilterBtns = document.querySelectorAll('.filter-btn');

    function isTypeFilter(f) { return f === 'corp' || f === 'selts'; }
    function isGenderFilter(f) { return f === 'female' || f === 'male'; }
    function isCityFilter(f) { return f === 'tallinn' || f === 'tartu'; }

    function updateAllFilterButtons() {
        allFilterBtns.forEach(function (btn) {
            var f = btn.getAttribute('data-filter');
            var active = false;
            if (f === 'all') active = (state.typeFilter === 'all' && state.genderFilter === 'all' && state.cityFilter === 'all');
            else if (isTypeFilter(f)) active = (state.typeFilter === f);
            else if (isGenderFilter(f)) active = (state.genderFilter === f);
            else if (isCityFilter(f)) active = (state.cityFilter === f);
            btn.classList.toggle('filter-btn--active', active);
        });
    }

    function onFilterChange() {
        updateAllFilterButtons();
        updateFilterToggles();
        renderList();
        // Reinitialize practice/test with new filtered set
        if (state.practiceInitialized) {
            initPractice();
        }
        if (state.testInitialized) {
            initTest();
        }
    }

    allFilterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var f = btn.getAttribute('data-filter');
            if (f === 'all') {
                state.typeFilter = 'all';
                state.genderFilter = 'all';
                state.cityFilter = 'all';
            } else if (isTypeFilter(f)) {
                state.typeFilter = (state.typeFilter === f) ? 'all' : f;
            } else if (isGenderFilter(f)) {
                state.genderFilter = (state.genderFilter === f) ? 'all' : f;
            } else if (isCityFilter(f)) {
                state.cityFilter = (state.cityFilter === f) ? 'all' : f;
            }
            track('filter', { filter: f });
            onFilterChange();
        });
    });

    /* ==================================================================
       List View — Search
    ================================================================== */
    var searchInput = document.getElementById('search-input');
    var searchDebounce = null;
    searchInput.addEventListener('input', function () {
        state.searchTerm = searchInput.value;
        renderList();
        clearTimeout(searchDebounce);
        if (searchInput.value.length > 0) {
            searchDebounce = setTimeout(function () {
                track('search', { search_term: searchInput.value });
            }, 1000);
        }
    });

    /* ==================================================================
       Map View
    ================================================================== */
    var mapCityBtns = document.querySelectorAll('.map-switcher__btn');

    function loadGoogleMaps() {
        if (state.mapLoaded) return;
        state.mapLoaded = true;

        if (!GOOGLE_MAPS_API_KEY) {
            document.getElementById('map-loading').textContent =
                'Google Maps API võti on seadistamata. Määra GOOGLE_MAPS_API_KEY failis app.js.';
            return;
        }

        var script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=' + GOOGLE_MAPS_API_KEY + '&callback=_initGoogleMap';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }

    window._initGoogleMap = function () {
        state.mapReady = true;
        var loadingEl = document.getElementById('map-loading');
        if (loadingEl) loadingEl.style.display = 'none';
        initMap();
    };

    function mapCenter(city) {
        return city === 'tallinn'
            ? { lat: 59.436289, lng: 24.761985 }
            : { lat: 58.377930, lng: 26.717139 };
    }

    function initMap() {
        state.map = new google.maps.Map(document.getElementById('map-container'), {
            center: mapCenter(state.mapCity),
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                { featureType: 'water', stylers: [{ color: '#c9d6e3' }] },
                { featureType: 'landscape', stylers: [{ color: '#f0ece4' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2ddd5' }] },
                { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6560' }] }
            ]
        });

        state.infoWindow = new google.maps.InfoWindow();
        placeMarkers();
    }

    function clearMarkers() {
        state.markers.forEach(function (m) { m.setMap(null); });
        state.markers = [];
    }

    function offsetMarkerPosition(lat, lng, distanceMeters, angleRadians) {
        var earthRadius = 6378137;
        var latOffset = (distanceMeters * Math.sin(angleRadians) / earthRadius) * (180 / Math.PI);
        var lngOffset = (distanceMeters * Math.cos(angleRadians) / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

        return {
            lat: lat + latOffset,
            lng: lng + lngOffset
        };
    }

    function markerDisplayEntries(city) {
        var groups = {};

        orgs.forEach(function (org) {
            if (!org.location || !org.location[city]) return;

            var loc = org.location[city];
            var key = loc.lat + ',' + loc.long;
            if (!groups[key]) groups[key] = [];
            groups[key].push({ org: org, loc: loc });
        });

        return Object.keys(groups).reduce(function (entries, key) {
            var group = groups[key];

            group.forEach(function (entry, index) {
                var position = { lat: entry.loc.lat, lng: entry.loc.long };

                if (group.length > 1) {
                    var angle = (-Math.PI / 2) + (2 * Math.PI * index / group.length);
                    var radiusMeters = 12;
                    position = offsetMarkerPosition(entry.loc.lat, entry.loc.long, radiusMeters, angle);
                }

                entries.push({
                    org: entry.org,
                    loc: entry.loc,
                    position: position
                });
            });

            return entries;
        }, []);
    }

    function placeMarkers() {
        clearMarkers();
        var city = state.mapCity;

        markerDisplayEntries(city).forEach(function (entry) {
            var org = entry.org;
            var loc = entry.loc;

            var marker = new google.maps.Marker({
                position: entry.position,
                map: state.map,
                title: org.name,
                icon: {
                    url: '../icons/' + org.slug + '.svg',
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16)
                }
            });

            // Fallback if SVG doesn't load
            var img = new Image();
            img.onerror = function () {
                var fallbackColor = resolveColor(org.palette ? org.palette.top : '') || '#8b2635';
                marker.setIcon({
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: fallbackColor,
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff'
                });
            };
            img.src = '../icons/' + org.slug + '.svg';

            marker.addListener('click', function () {
                track('map_marker_click', { org: org.name, city: city });
                state.infoWindow.setContent(buildInfoWindow(org, city));
                state.infoWindow.open(state.map, marker);
            });

            state.markers.push(marker);
        });
    }

    function buildInfoWindow(org, city) {
        var h = '<div class="map-info">';
        h += '<div class="map-info__header">';
        h += '<img class="map-info__crest" src="../icons/' + esc(org.slug) + '.svg" onerror="this.style.display=\'none\'">';
        h += '<span class="map-info__name">' + esc(org.name) + '</span>';
        h += '</div>';
        if (org.location[city] && org.location[city].address) {
            h += '<p class="map-info__address">' + esc(org.location[city].address) + '</p>';
        }
        if (org.url && org.url !== '-') {
            var display = org.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            h += '<a class="map-info__link" href="' + esc(org.url) + '" target="_blank" rel="noopener">' + esc(display) + '</a>';
        }
        h += '</div>';
        return h;
    }

    function switchMapCity(city) {
        track('map_city_switch', { city: city });
        state.mapCity = city;
        mapCityBtns.forEach(function (b) {
            var isActive = b.getAttribute('data-city') === city;
            b.classList.toggle('map-switcher__btn--active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        if (state.mapReady && state.map) {
            state.map.setCenter(mapCenter(city));
            placeMarkers();
        }
    }

    mapCityBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchMapCity(btn.getAttribute('data-city'));
        });
    });

    /* ==================================================================
       Swipe Support
    ================================================================== */
    function addSwipeSupport(areaEl, cardEl, onSwipe) {
        var startX = 0;
        var startY = 0;
        var currentX = 0;
        var tracking = false;
        var THRESHOLD = 60;

        areaEl.addEventListener('touchstart', function (e) {
            var t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            currentX = startX;
            tracking = true;
            cardEl.style.transition = 'none';
        }, { passive: true });

        areaEl.addEventListener('touchmove', function (e) {
            if (!tracking) return;
            var t = e.touches[0];
            var dx = t.clientX - startX;
            var dy = t.clientY - startY;

            // If more vertical than horizontal, release
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) {
                tracking = false;
                cardEl.style.transform = '';
                cardEl.style.opacity = '';
                cardEl.style.transition = '';
                return;
            }

            e.preventDefault();
            currentX = t.clientX;
            cardEl.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx * 0.04) + 'deg)';
            cardEl.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 350));
        }, { passive: false });

        areaEl.addEventListener('touchend', function () {
            if (!tracking) return;
            tracking = false;
            var dx = currentX - startX;
            cardEl.style.transition = '';

            if (Math.abs(dx) > THRESHOLD) {
                onSwipe(dx > 0 ? 'right' : 'left');
            } else {
                cardEl.style.transform = '';
                cardEl.style.opacity = '';
            }
        }, { passive: true });
    }

    /* ==================================================================
       Practice View
    ================================================================== */
    var practiceCard = document.getElementById('practice-card');
    var practiceFront = document.getElementById('practice-front');
    var practiceBack = document.getElementById('practice-back');
    var practiceRevealBtn = document.getElementById('practice-reveal');
    var practiceNextBtn = document.getElementById('practice-next');
    var practiceCounter = document.getElementById('practice-counter');

    function initPractice() {
        var filtered = filterOrgs();
        state.practiceDeck = shuffle(filtered.length ? filtered : orgs.slice());
        state.practiceIndex = 0;
        state.practiceInitialized = true;
        showPracticeCard();
    }

    function showPracticeCard() {
        if (state.practiceIndex >= state.practiceDeck.length) {
            var filtered = filterOrgs();
            state.practiceDeck = shuffle(filtered.length ? filtered : orgs.slice());
            state.practiceIndex = 0;
        }

        var org = state.practiceDeck[state.practiceIndex];
        state.practiceRevealed = false;

        practiceCounter.textContent = (state.practiceIndex + 1) + ' / ' + state.practiceDeck.length;

        // Front — no crest, as it reveals colors
        var fHtml = '<h2 class="practice__org-name">' + esc(org.name) + '</h2>';
        fHtml += '<p class="practice__hint">Proovi meenutada, seejärel vaata vastust</p>';
        practiceFront.innerHTML = fHtml;
        practiceFront.style.display = '';
        practiceFront.style.opacity = '';
        practiceFront.style.transition = '';

        // Back
        practiceBack.innerHTML = buildPracticeBack(org);
        practiceBack.classList.remove('revealed');

        practiceRevealBtn.hidden = false;
        practiceNextBtn.hidden = true;

        // Animate
        practiceCard.classList.remove('card--exit-left', 'card--exit-right', 'card--enter');
        practiceCard.style.transform = '';
        practiceCard.style.opacity = '';
        void practiceCard.offsetWidth; // force reflow
        practiceCard.classList.add('card--enter');
    }

    function buildPracticeBack(org) {
        var topColor = resolveColor(org.palette ? org.palette.top : '');
        var midColor = resolveColor(org.palette ? org.palette.middle : '');
        var botColor = resolveColor(org.palette ? org.palette.bottom : '');

        var h = '';
        h += '<img class="practice-back__crest" src="../icons/' + esc(org.slug) + '.svg" alt="" onerror="this.style.display=\'none\'">';
        h += '<h3 class="practice-back__name">' + esc(org.name) + '</h3>';

        h += '<div class="practice-back__divider"></div>';

        if (org.foundedFormatted) {
            h += '<div class="practice-detail"><span class="practice-detail__label">Asutatud</span><span class="practice-detail__value">' + esc(org.foundedFormatted) + '</span></div>';
        }
        var pColorText = (org.palette && org.palette.text) ? org.palette.text : '–';
        h += '<div class="practice-detail"><span class="practice-detail__label">Värvid</span><span class="practice-detail__value">' + esc(pColorText) + '</span></div>';

        var pMemberText = org.member || '–';
        h += '<div class="practice-detail"><span class="practice-detail__label">Liige</span><span class="practice-detail__value">' + esc(pMemberText) + '</span></div>';
        if (org.location && org.location.tartu) {
            h += '<div class="practice-detail"><span class="practice-detail__label">Tartu</span><span class="practice-detail__value">' + esc(org.location.tartu.address) + '</span></div>';
        }
        if (org.location && org.location.tallinn) {
            h += '<div class="practice-detail"><span class="practice-detail__label">Tallinn</span><span class="practice-detail__value">' + esc(org.location.tallinn.address) + '</span></div>';
        }
        h += '<div class="practice-detail"><span class="practice-detail__label">Tüüp</span><span class="practice-detail__value">' + esc(orgTypeLabel(org)) + '</span></div>';

        if (org.motto) {
            h += '<p class="practice-back__motto">' + esc(org.motto) + '</p>';
        }

        return h;
    }

    function revealPractice() {
        track('practice_reveal', { org: state.practiceDeck[state.practiceIndex].name });
        state.practiceRevealed = true;
        practiceFront.style.transition = 'opacity 200ms ease-out';
        practiceFront.style.opacity = '0';
        setTimeout(function () {
            practiceFront.style.display = 'none';
            practiceBack.classList.add('revealed');
        }, 200);
        practiceRevealBtn.hidden = true;
        practiceNextBtn.hidden = false;
    }

    function nextPractice(direction) {
        track('practice_next');
        var exitClass = direction === 'left' ? 'card--exit-left' : 'card--exit-right';
        practiceCard.classList.add(exitClass);

        setTimeout(function () {
            state.practiceIndex++;
            showPracticeCard();
        }, 260);
    }

    practiceRevealBtn.addEventListener('click', revealPractice);
    practiceNextBtn.addEventListener('click', function () { nextPractice('left'); });

    addSwipeSupport(
        document.getElementById('practice-area'),
        practiceCard,
        function (dir) {
            if (!state.practiceRevealed) {
                revealPractice();
            } else {
                nextPractice(dir);
            }
        }
    );

    /* ==================================================================
       Test View
    ================================================================== */
    var testCard = document.getElementById('test-card');
    var testQuestion = document.getElementById('test-question');
    var testAnswer = document.getElementById('test-answer');
    var testRevealBtn = document.getElementById('test-reveal');
    var testNextBtn = document.getElementById('test-next');
    var testCounter = document.getElementById('test-counter');

    function generateAllQuestions() {
        var filtered = filterOrgs();
        var source = filtered.length ? filtered : orgs;
        var questions = [];
        source.forEach(function (org) {
            ATTRIBUTE_MAP.forEach(function (attr) {
                var val = attr.getValue(org);
                if (val && val !== '-') {
                    questions.push({
                        org: org,
                        attrKey: attr.key,
                        question: generateQuestionText(org.name, attr.key),
                        answer: val
                    });
                }
            });
        });
        return shuffle(questions);
    }

    function initTest() {
        state.testQuestions = generateAllQuestions();
        state.testIndex = 0;
        state.testInitialized = true;
        showTestCard();
    }

    function showTestCard() {
        if (!state.testQuestions.length || state.testIndex >= state.testQuestions.length) {
            state.testQuestions = generateAllQuestions();
            state.testIndex = 0;
        }

        var q = state.testQuestions[state.testIndex];
        state.testRevealed = false;

        testCounter.textContent = (state.testIndex + 1) + ' / ' + state.testQuestions.length;

        testQuestion.innerHTML = '<p class="test__question-text">' + esc(q.question) + '</p>';
        testQuestion.style.display = '';
        testQuestion.style.opacity = '';
        testQuestion.style.transition = '';

        testAnswer.innerHTML = '<div class="test__answer-divider"></div><p class="test__answer-text">' + esc(q.answer) + '</p>';
        testAnswer.classList.remove('revealed');

        testRevealBtn.hidden = false;
        testNextBtn.hidden = true;

        testCard.classList.remove('card--exit-left', 'card--exit-right', 'card--enter');
        testCard.style.transform = '';
        testCard.style.opacity = '';
        void testCard.offsetWidth;
        testCard.classList.add('card--enter');
    }

    function revealTest() {
        track('test_reveal', { question: state.testQuestions[state.testIndex].question });
        state.testRevealed = true;
        testAnswer.classList.add('revealed');
        testRevealBtn.hidden = true;
        testNextBtn.hidden = false;
    }

    function nextTest(direction) {
        track('test_next');
        var exitClass = direction === 'left' ? 'card--exit-left' : 'card--exit-right';
        testCard.classList.add(exitClass);

        setTimeout(function () {
            state.testIndex++;
            showTestCard();
        }, 260);
    }

    testRevealBtn.addEventListener('click', revealTest);
    testNextBtn.addEventListener('click', function () { nextTest('left'); });

    addSwipeSupport(
        document.getElementById('test-area'),
        testCard,
        function (dir) {
            if (!state.testRevealed) {
                revealTest();
            } else {
                nextTest(dir);
            }
        }
    );

    /* ==================================================================
       Navigation Tabs
    ================================================================== */
    var navTabs = document.querySelectorAll('.nav__tab');
    var views = {
        list: document.getElementById('view-list'),
        map: document.getElementById('view-map'),
        practice: document.getElementById('view-practice'),
        test: document.getElementById('view-test')
    };

    var VIEW_HASH = {
        list: 'nimekiri',
        map: 'kaart',
        practice: 'harjuta',
        test: 'test'
    };
    var HASH_VIEW = {};
    Object.keys(VIEW_HASH).forEach(function (k) { HASH_VIEW[VIEW_HASH[k]] = k; });

    function switchToView(view, updateHash) {
        if (!views[view]) return;

        navTabs.forEach(function (t) {
            t.classList.remove('nav__tab--active');
            t.setAttribute('aria-selected', 'false');
        });
        // Activate the matching tab
        navTabs.forEach(function (t) {
            if (t.getAttribute('data-view') === view) {
                t.classList.add('nav__tab--active');
                t.setAttribute('aria-selected', 'true');
            }
        });

        Object.keys(views).forEach(function (key) {
            if (views[key]) {
                views[key].classList.remove('view--active');
                views[key].setAttribute('hidden', '');
            }
        });
        views[view].classList.add('view--active');
        views[view].removeAttribute('hidden');

        state.activeView = view;
        track('view_switch', { view: view });
        trackPageView(view);

        if (view === 'practice' || view === 'test') {
            document.body.classList.add('no-scroll');
        } else {
            document.body.classList.remove('no-scroll');
        }

        if (updateHash !== false) {
            history.replaceState(null, '', '#' + VIEW_HASH[view]);
        }

        // Lazy initialization
        if (view === 'map' && !state.mapLoaded) loadGoogleMaps();
        if (view === 'practice' && !state.practiceInitialized) initPractice();
        if (view === 'test' && !state.testInitialized) initTest();
    }

    navTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            switchToView(tab.getAttribute('data-view'));
        });
    });

    // Handle browser back/forward
    window.addEventListener('hashchange', function () {
        var hash = location.hash.replace('#', '');
        if (HASH_VIEW[hash]) switchToView(HASH_VIEW[hash], false);
    });

    /* ==================================================================
       Keyboard support for Practice & Test
    ================================================================== */
    document.addEventListener('keydown', function (e) {
        if (state.activeView === 'practice') {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!state.practiceRevealed) {
                    revealPractice();
                } else {
                    nextPractice('left');
                }
            }
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (state.practiceRevealed) {
                    nextPractice(e.key === 'ArrowLeft' ? 'left' : 'right');
                } else {
                    revealPractice();
                }
            }
        }

        if (state.activeView === 'test') {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!state.testRevealed) {
                    revealTest();
                } else {
                    nextTest('left');
                }
            }
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (state.testRevealed) {
                    nextTest(e.key === 'ArrowLeft' ? 'left' : 'right');
                } else {
                    revealTest();
                }
            }
        }
    });

    /* ==================================================================
       Mobile filter toggle
    ================================================================== */
    var filterSections = document.querySelectorAll('.filters__buttons');
    var filterToggles = [];

    filterSections.forEach(function (btnGroup) {
        var parent = btnGroup.parentNode;

        // Find the counter - could be inside .filters or a sibling in the card-view
        var counter = parent.querySelector('.card-view__counter, .filters__count');
        if (!counter) {
            var grandparent = parent.parentNode;
            if (grandparent) {
                counter = grandparent.querySelector('.card-view__counter, .filters__count');
            }
        }

        // Create toolbar row
        var toolbar = document.createElement('div');
        toolbar.className = 'filters__toolbar';

        var toggle = document.createElement('button');
        toggle.className = 'filters__toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></svg><span>Filtrid</span>';

        toolbar.appendChild(toggle);
        if (counter) {
            toolbar.appendChild(counter);
        }

        parent.insertBefore(toolbar, btnGroup);

        // Start collapsed on mobile
        btnGroup.classList.add('filters__buttons--collapsed');

        toggle.addEventListener('click', function () {
            var collapsed = btnGroup.classList.toggle('filters__buttons--collapsed');
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        });

        filterToggles.push(toggle);
    });

    function updateFilterToggles() {
        var hasFilter = state.typeFilter !== 'all' || state.genderFilter !== 'all' || state.cityFilter !== 'all';
        filterToggles.forEach(function (t) {
            t.classList.toggle('filters__toggle--has-filter', hasFilter);
            var label = hasFilter ? 'Filtrid (aktiivne)' : 'Filtrid';
            t.querySelector('span').textContent = label;
        });
    }

    /* ==================================================================
       Nav height measurement
    ================================================================== */
    function updateNavHeight() {
        var nav = document.querySelector('.nav');
        if (nav) {
            document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
        }
    }
    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);

    /* ==================================================================
       Footer link tracking
    ================================================================== */
    var footerLinks = document.querySelectorAll('.list-footer__link');
    footerLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            var label = link.getAttribute('aria-label') || 'unknown';
            track('footer_link', { type: label });
        });
    });

    /* ==================================================================
       Initial Render
    ================================================================== */
    renderList();

    // Restore view from URL hash
    var initialHash = location.hash.replace('#', '');
    if (HASH_VIEW[initialHash]) {
        switchToView(HASH_VIEW[initialHash]);
    } else {
        trackPageView('list');
    }

})();
