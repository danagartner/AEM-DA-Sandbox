export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        let accordion = document.createElement('details');
        let summary = document.createElement('summary');

        console.log(row.firstElementChild);
    });
}
