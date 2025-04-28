# **HentaiJS 🔞**

A sleek and high-performance library for fetching content from various hentai sources. Fast, efficient, and built for seamless integration. :3

## ✨ **Features**
- 🚀 **Effortless API**: Simplified integration for a smooth experience.
- ⚡ **Blazing fast**: Minimal latency for ultra-fast data retrieval.
- 🔄 **Multi-provider support**: Search across various providers for a wider range of results.
- 📚 **Comprehensive documentation**: Everything you need to get started.
- 🔧 **TypeScript & JavaScript compatible**: Flexibility to suit your preferred language.

## 📦 **Installation**

```sh
npm install @mohtasimalam/hentai.js
# Or with Bun
bun add @mohtasimalam/hentai.js
```

## 📋 **Example Usage (Rule34)**

```ts
// Import the Rule34 provider
import { Rule34 } from "@mohtasimalam/hentai.js";

const r34 = new Rule34();

const main = async () => {
    // Fetch search suggestions (autocomplete) from Rule34, since it's highly query-sensitive
    const autoComplete = await r34.searchAutocomplete("alisa");

    // Use the first suggestion's completed query to fetch the search results
    const search = await r34.search(autoComplete[0].completedQuery);

    // Output the search results
    console.log(search); // Array of results
};
```

## **Available Providers**
- HentaiHaven
- HAnime
- Rule34

More providers coming soon!
