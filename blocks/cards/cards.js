import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');

  // Looping through the children elements and adding them to the newly created UL to add it back to the block
  [...block.children].forEach((row) => {

    // Create a new li element and add a class to it
    const li = document.createElement('li');
    li.className = 'cards-card';
    
    // Move all child elements to the li element
    while (row.firstElementChild) {
      li.append(row.firstElementChild);
    }

    // Add classes to each DIV within the block
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';
      } else {
        div.className = 'cards-card-body';
      }
    });

    // Add each li to the ul
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  block.replaceChildren(ul);
}
