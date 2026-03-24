"use strict";
// src/services/newsService.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndStoreNews = void 0;
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../config/db"));
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const GNEWS_BASE_URL = 'https://gnews.io/api/v4';
const fetchAndStoreNews = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!GNEWS_API_KEY) {
        console.error('GNEWS_API_KEY is missing from .env');
        return { success: false, error: 'API Key missing' };
    }
    try {
        console.log('[NewsAggregator] Fetching latest current affairs...');
        // Fetch top news for India / Education / General
        // We use "search" to get highly relevant current affairs
        const response = yield axios_1.default.get(`${GNEWS_BASE_URL}/search`, {
            params: {
                q: 'India AND (education OR economy OR policy OR technology OR "current affairs")',
                lang: 'en',
                country: 'in',
                max: 15,
                sortby: 'publishedAt',
                apikey: GNEWS_API_KEY
            }
        });
        const articles = response.data.articles;
        if (!articles || articles.length === 0) {
            return { success: true, added: 0, message: 'No new articles found.' };
        }
        let addedCount = 0;
        // Loop through and insert safely
        for (const article of articles) {
            try {
                // We use upsert to ensure we never duplicate an article if it was already fetched
                yield db_1.default.article.upsert({
                    where: { source_url: article.url },
                    update: {}, // Do nothing if it already exists
                    create: {
                        title: article.title,
                        summary: article.description || article.content, // Fallback to content if desc is empty
                        source_name: article.source.name,
                        source_url: article.url,
                        image_url: article.image,
                        content: article.content || null,
                        published_at: new Date(article.publishedAt)
                    }
                });
                addedCount++;
            }
            catch (dbError) {
                // Silently ignore unique constraint errors just in case upsert behaves weirdly on long URLs
                continue;
            }
        }
        console.log(`[NewsAggregator] Successfully processed. Added/Checked ${addedCount} articles.`);
        return { success: true, added: addedCount };
    }
    catch (error) {
        console.error('[NewsAggregator] Failed to fetch news:', error.message);
        return { success: false, error: error.message };
    }
});
exports.fetchAndStoreNews = fetchAndStoreNews;
