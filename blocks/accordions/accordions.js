export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        let accordion = document.createElement('details');
        let summary = document.createElement('summary');
        let summaryText = row.firstElementChild.firstElementChild.innerHTML

        summary.innerHTML = summaryText;

        console.log(summary);
    });
}
