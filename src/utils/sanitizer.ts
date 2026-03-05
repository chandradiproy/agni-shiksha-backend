// src/utils/sanitizer.ts

import sanitizeHtml from 'sanitize-html';

export const sanitizeContent = (dirtyText: string | undefined | null): string => {
  if (!dirtyText) return '';
  
  return sanitizeHtml(dirtyText, {
    // Allow standard formatting, lists, tables, and images
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'sup', 'sub', 'math', 'mrow', 'mi', 'mn', 'mo', 'msup'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      // Specifically allow image sources and alternative text
      'img': ['src', 'alt', 'width', 'height'],
      // Allow styling for layout if necessary
      '*': ['style', 'class'] 
    },
    // Enforce https on image URLs
    allowedSchemesByTag: {
      img: ['https', 'data']
    }
  });
};