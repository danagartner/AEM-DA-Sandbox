export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        let details = document.createElement('details');
        let summary = document.createElement('summary');
        let summaryText = row.children[0].firstElementChild.innerHTML;
        let detailsContent = row.children[1];
        detailsContent.className = "details-content";

        summary.innerHTML = summaryText;
        details.append(summary);
        details.append(detailsContent);

        row.replaceWith(details);
    });

    const section = block.closest('.accordions-container');
    console.log(section);
}
