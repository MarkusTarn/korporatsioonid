const id = (id) => document.getElementById(id)

const toggleVisible = (event) => {
	const [tabId, name] = event.target.parentElement.id.split('-')
	const content = id(`${tabId}-${name}-content`)
	if (content.classList.contains('hide')) content.classList.remove('hide');
	else content.classList.add('hide');
	event.target.innerHTML = event.target.innerHTML === 'visibility' ? 'visibility_off' : 'visibility'
}

const mapSearchData = (corpData) => {
	const searchData = { tühista: null, " ": 'https://placehold.it/250x250' }
	corpData.forEach(corp => {
		searchData[corp.name.toLowerCase()] = null
		searchData[corp.founded.toLowerCase()] = null
		searchData[corp.palette.text.toLowerCase()] = null
		searchData[corp.member.toLowerCase()] = null
		searchData[corp.url.toLowerCase()] = null
	})
	return searchData
}

const filterSearchData = (corpData, filter) => corpData.filter((corp) => {
	return corp.name.toLowerCase() === filter
	|| corp.founded.toLowerCase() === filter
	|| corp.palette.text.toLowerCase() === filter
	|| corp.member.toLowerCase() === filter
	|| corp.url.toLowerCase() === filter
})

const generateCard = (corpData, tabId) => `
	<div class="card">
		<div class="card-content">
			<span class="card-title">
				${tabId === 'test' ? '<a id="' + tabId + '-' + corpData.slug + '-toggle" class="right waves-effect waves-circle waves-light" href="#"><i class="small material-icons">visibility</i></a>' : ''}
				${tabId === 'test' ? '' : '<a class="right" href="' + corpData.url + '" target="_blank"><i class="small material-icons">public</i></a>'}
				${corpData.name}
			</span>

			<div id="${tabId}-${corpData.slug}-content" class="row test">
				<div class="col s12 m6">
					<div class="hat">
						<div class="top ${corpData.palette.top}"></div>
						<div class="middle ${corpData.palette.middle}"></div>
						<div class="bottom ${corpData.palette.bottom}"></div>
					</div>
				</div>
				<div class="col s12 m6">
					<ul>
						<li><i class="tiny material-icons">perm_contact_calendar</i> ${new Date(corpData.founded).toLocaleDateString()}</li>
						<li><i class="tiny material-icons">palette</i> ${corpData.palette.text}</li>
						<li><i class="tiny material-icons">person</i> ${corpData.member}</li>
						<li><i class="tiny material-icons">flag</i> "${corpData.motto}"</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
`

const getRandomCard = (corpList) => {
	const [randomCorp] = corpList.splice(Math.floor(Math.random() * corpList.length), 1)
	id('test-container').innerHTML = generateCard(randomCorp, 'test')
	id(`test-${randomCorp.slug}-content`).classList.add('hide')
	id(`test-${randomCorp.slug}-toggle`).onclick = (e) => toggleVisible(e)
}

const fillCorpList = (corps, tabId) => {
	id(tabId).innerHTML = ''
	corps.forEach(corp => id(tabId).innerHTML += generateCard(corp, tabId))
}

const finishSearch = (event, corpData, container) => {
	if (event.type === 'keyup' && event.target.value === '') {
		fillCorpList(corpData, container)
	}
}
