/**
 * Closes or Opens all details elements at once when a specific button is clicked
 * @param {ClickEvent} e click event
 */
const handleToggleDetails = (e, block) => {
    let rows = [...block.children];

    const toggleDetails = (item) => {
        if(e.target.classList.contains('open-btn')) {
            item.setAttribute('open', '');
        } else {
            item.removeAttribute('open');
        }
    }

    rows.forEach(row => {
        toggleDetails(row);
    });
}

/**
 * turns block elements into details accordions
 * @param {Element} block The header block element
 */
export default function decorate(block) {
    const rows = [...block.children];

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

    /* ----------------------------------------------------------------
        See if the section has the data-controls attribute
        if so lets create and add buttons to toggle open and closed ALL the accordions
    -------------------------------------------------------------------*/
    
    const section = block.closest('.accordions-container');
    
    if(section.hasAttribute('data-controls')) {
        const detailsOpenBtn = Object.assign(document.createElement('button'), {
            className: 'open-btn',
            innerHTML: 'Open All',
            ariaLabel: 'Open all accordions'
        });
        const detailsCloseBtn = Object.assign(document.createElement('button'), {
            className: 'close-btn',
            innerHTML: 'Close All',
            ariaLabel: 'Close all accordions'
        });
        const detailsControls = Object.assign(document.createElement('div'), {
            className: 'details-controls',
        });

        detailsControls.append(detailsOpenBtn, detailsCloseBtn);
        block.closest('.accordions-wrapper').insertBefore(detailsControls, block);

        detailsControls.addEventListener('click', (e) => {
            handleToggleDetails(e, block);
        });
    }
}
