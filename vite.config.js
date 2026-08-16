/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { Client, Users, Databases, Query } from 'node-appwrite';

function adminApiPlugin(env) {
  return {
    name: 'admin-api',
    configureServer(server) {
      server.middlewares.use('/api/dev-admin-db', async (req, res) => {
        // Only allow GET requests
        if (req.method !== 'GET') {
          res.statusCode = 405;
          return res.end('Method not allowed');
        }

        try {
          // Initialize Appwrite Server SDK
          const client = new Client()
            .setEndpoint(env.VITE_APPWRITE_ENDPOINT)
            .setProject(env.VITE_APPWRITE_PROJECT_ID)
            .setKey(env.APPWRITE_API_KEY);

          const usersService = new Users(client);
          const databasesService = new Databases(client);

          const DB_ID = 'audrio_db';
          const COLLECTIONS = ['manifest', 'tokens', 'preferences', 'playlists', 'lyrics', 'stats'];

          // Fetch all users
          const usersRes = await usersService.list();
          const allUsers = usersRes.users;

          // Fetch documents from collections
          const rawResults = {};
          for (const col of COLLECTIONS) {
            try {
               const docRes = await databasesService.listDocuments(DB_ID, col, [
                 Query.limit(500)
               ]);
               rawResults[col] = docRes.documents;
            } catch (e) {
               console.warn(`Failed to fetch collection ${col} in server SDK:`, e.message);
               rawResults[col] = [];
            }
          }

          // Build Firebase-like structure
          const firebaseLikeStructure = { users: {} };
          
          // Seed users
          allUsers.forEach(u => {
            firebaseLikeStructure.users[u.$id] = { profile: u };
          });

          // Sort documents into the respective user's node
          for (const col of COLLECTIONS) {
            const docs = rawResults[col] || [];
            
            // Temporary map to group docs by user
            const groupedByUser = {};

            docs.forEach(doc => {
              // Extract userId either from the document directly or infer from ID
              // Usually tokens use gdrive_{userId}, manifests use {userId} (if custom ID) or have a `userId` field
              let userId = doc.userId; 
              if (!userId) {
                if (doc.$id.startsWith('gdrive_')) {
                  userId = doc.$id.replace('gdrive_', '');
                } else if (firebaseLikeStructure.users[doc.$id]) {
                  // The document ID is exactly the user ID (like preferences)
                  userId = doc.$id;
                } else if (doc.$permissions && doc.$permissions.length > 0) {
                  // Fallback: Check permissions array for read("user:xxx")
                  const readPerm = doc.$permissions.find(p => p.startsWith('read("user:'));
                  if (readPerm) {
                    const match = readPerm.match(/read\("user:([^"]+)"\)/);
                    if (match) userId = match[1];
                  }
                }
              }

              if (userId) {
                if (!groupedByUser[userId]) groupedByUser[userId] = [];
                const { $collectionId, $databaseId, $permissions, ...rest } = doc;
                // Suppress unused vars from destructuring
                void $collectionId;
                void $databaseId;
                void $permissions;
                groupedByUser[userId].push(rest);
              }
            });

            // For each user, attach their docs
            Object.keys(firebaseLikeStructure.users).forEach(uid => {
              const userDocs = groupedByUser[uid] || [];
              if (userDocs.length === 0) {
                 // No docs for this collection
              } else if (userDocs.length === 1 && (userDocs[0].$id === uid || userDocs[0].$id === `gdrive_${uid}`)) {
                 // Flatten if single doc and ID matches user pattern
                 firebaseLikeStructure.users[uid][col] = userDocs[0];
              } else {
                 // Convert array to a map keyed by document ID
                 const colMap = {};
                 userDocs.forEach(d => {
                   colMap[d.$id] = d;
                 });
                 firebaseLikeStructure.users[uid][col] = colMap;
              }
            });
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(firebaseLikeStructure));
        } catch (error) {
          console.error("Error in /api/dev-admin-db:", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  }
}

function mepcoApiPlugin() {
  return {
    name: 'mepco-api',
    configureServer(server) {
      server.middlewares.use('/api/fetch-bill', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const refno = url.searchParams.get('refno');
        
        if (!refno || refno.length < 14) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Invalid reference number' }));
        }

        try {
          const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          };

          const res1 = await fetch(targetUrl, { headers });
          const html1 = await res1.text();
          
          if (!html1.includes('__VIEWSTATE')) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Failed to access PITC server. The page may be down.' }));
          }

          const rawSetCookie = res1.headers.get('set-cookie') || '';
          const sessionId = (rawSetCookie.match(/ASP\.NET_SessionId=([a-z0-9]+)/i) || [])[1] || '';
          const rvtFromCookie = (rawSetCookie.match(/__RequestVerificationToken=([^;,\s]+)/) || [])[1] || '';

          const getHidden = (name) => {
            const m = html1.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) ||
                      html1.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
            return m ? m[1] : '';
          };

          const vs  = getHidden('__VIEWSTATE');
          const vsg = getHidden('__VIEWSTATEGENERATOR');
          const ev  = getHidden('__EVENTVALIDATION');
          const rvtForm = getHidden('__RequestVerificationToken') || rvtFromCookie;

          const cookieStr = [
            sessionId ? `ASP.NET_SessionId=${sessionId}` : '',
            rvtFromCookie ? `__RequestVerificationToken=${rvtFromCookie}` : ''
          ].filter(Boolean).join('; ');

          const formData = new URLSearchParams({
            __EVENTTARGET: '',
            __EVENTARGUMENT: '',
            __LASTFOCUS: '',
            __VIEWSTATE: vs,
            __VIEWSTATEGENERATOR: vsg,
            __EVENTVALIDATION: ev,
            __RequestVerificationToken: rvtForm,
            rbSearchByList: 'refno',
            searchTextBox: refno,
            ruCodeTextBox: '',
            btnSearch: 'Search'
          });

          const res2 = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookieStr,
              'Referer': targetUrl,
              'Origin': 'http://bill.pitc.com.pk'
            },
            body: formData.toString()
          });

          const html2 = await res2.text();
          
          res.setHeader('Content-Type', 'text/html');
          res.end(html2);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to complete request: ' + error.message }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), adminApiPlugin(env), mepcoApiPlugin()],
  };
});
