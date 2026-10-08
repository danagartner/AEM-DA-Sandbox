export default function decorate(block) {
  const rows = [...block.children];
  
  rows.forEach((row) => {
    console.log(row);
    console.log(row.firstElementChild);
  });
}
