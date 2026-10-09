export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        let details = document.createElement('details');
        let summary = document.createElement('summary');
        let summaryText = row.children[0].firstElementChild.innerHTML;
        let detailsContent = row.children[1].firstElementChild.innerHTML;

        summary.innerHTML = summaryText;
        details.append(summary);
        details.append(detailsContent);

        console.log(details);
        row.replaceChildren(details)
    });
}
