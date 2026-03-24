"use strict";
// src/utils/sanitizer.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeContent = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const sanitizeContent = (dirtyText) => {
    if (!dirtyText)
        return '';
    return (0, sanitize_html_1.default)(dirtyText, {
        // Allow standard formatting, lists, tables, and images
        allowedTags: sanitize_html_1.default.defaults.allowedTags.concat([
            'img', 'sup', 'sub', 'math', 'mrow', 'mi', 'mn', 'mo', 'msup'
        ]),
        allowedAttributes: Object.assign(Object.assign({}, sanitize_html_1.default.defaults.allowedAttributes), { 
            // Specifically allow image sources and alternative text
            'img': ['src', 'alt', 'width', 'height'], 
            // Allow styling for layout if necessary
            '*': ['style', 'class'] }),
        // Enforce https on image URLs
        allowedSchemesByTag: {
            img: ['https', 'data']
        }
    });
};
exports.sanitizeContent = sanitizeContent;
