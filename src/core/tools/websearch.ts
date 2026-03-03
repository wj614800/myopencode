import https from 'node:https';

export async function webSearch(query: string): Promise<string> {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://duckduckgo.com/html/?q=${encodedQuery}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const results: string[] = [];
        const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        
        let match;
        while ((match = resultRegex.exec(data)) !== null && results.length < 5) {
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          results.push(`- ${title}`);
        }
        
        if (results.length > 0) {
          resolve(`Search results for "${query}":\n\n${results.join('\n')}`);
        } else {
          resolve(`No results found for: ${query}`);
        }
      });
    }).on('error', (error) => {
      resolve(`Search error: ${error.message}`);
    });
  });
}
