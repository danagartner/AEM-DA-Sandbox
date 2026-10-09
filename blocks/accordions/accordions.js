export default function decorate(block) {
    let children = [...block.children];
    console.log(children);

    children.forEach(child => {
        console.log(child);
    });
}
