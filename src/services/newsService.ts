// src/services/newsService.ts

import axios from 'axios';
import prisma from '../config/db';

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const GNEWS_BASE_URL = 'https://gnews.io/api/v4';

export const fetchAndStoreNews = async () => {
  if (!GNEWS_API_KEY) {
    console.error('GNEWS_API_KEY is missing from .env');
    return { success: false, error: 'API Key missing' };
  }

  try {
    console.log('[NewsAggregator] Fetching latest current affairs...');
    
    // Fetch top news for India / Education / General
    // We use "search" to get highly relevant current affairs
    const response = await axios.get(`${GNEWS_BASE_URL}/search`, {
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
        await prisma.article.upsert({
          where: { source_url: article.url },
          update: {}, // Do nothing if it already exists
          create: {
            title: article.title,
            summary: article.description || article.content, // Fallback to content if desc is empty
            source_name: article.source.name,
            source_url: article.url,
            image_url: article.image,
            content: article.content||null,
            published_at: new Date(article.publishedAt)
          }
        });
        addedCount++;
      } catch (dbError) {
        // Silently ignore unique constraint errors just in case upsert behaves weirdly on long URLs
        continue;
      }
    }

    console.log(`[NewsAggregator] Successfully processed. Added/Checked ${addedCount} articles.`);
    return { success: true, added: addedCount };

  } catch (error: any) {
    console.error('[NewsAggregator] Failed to fetch news:', error.message);
    return { success: false, error: error.message };
  }
};