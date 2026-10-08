export default function decorate(block) {
    let rows = [...block.children];

    rows.forEach(row => {
        console.log(row);
    });
}
