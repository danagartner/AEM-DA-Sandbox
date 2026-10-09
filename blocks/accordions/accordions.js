export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        let details = document.createElement('details');
        let summary = document.createElement('summary');
        let summaryText = row.children[0].firstElementChild.innerHTML;
        let detailsContent = row.children[1];
        detailsContent.className = "details-content";

        summary.innerHTML = summaryText;
        details.append(summary, detailsContent);

        row.replaceWith(details);
    });

    // See if the section has the data-controls attribute, and if so lets create and add buttons to toggle open and closed the accordions
    const section = block.closest('.accordions-container');
    
    if(section.hasAttribute('data-controls')) {
        const detailsOpenBtn = Object.assign(document.createElement('button'), {
            className: 'open-btn',
            innerHTML: 'Open All'
        });
        const detailsCloseBtn = Object.assign(document.createElement('button'), {
            className: 'close-btn',
            innerHTML: 'Close All'
        });

        let detailsControls = document.createElement('div');
        detailsControls.append(detailsOpenBtn, detailsCloseBtn);
        block.insertBefore(detailsControls);
    }
}
