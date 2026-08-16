export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  try {
    const { Client, Users, Databases, Query } = await import('node-appwrite');
    // Initialize Appwrite Server SDK
    const client = new Client()
      .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
      .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

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
        let userId = doc.userId; 
        if (!userId) {
          if (doc.$id.startsWith('gdrive_')) {
            userId = doc.$id.replace('gdrive_', '');
          } else if (firebaseLikeStructure.users[doc.$id]) {
            userId = doc.$id;
          } else if (doc.$permissions && doc.$permissions.length > 0) {
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
           firebaseLikeStructure.users[uid][col] = userDocs[0];
        } else {
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
}
