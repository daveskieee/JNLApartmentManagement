// Migration: Add file attachment support to complaints
module.exports = async (db) => {
  return new Promise((resolve, reject) => {
    // Add columns for file attachments to complaints table
    db.run(
      `ALTER TABLE complaints ADD COLUMN attachment_filename TEXT`,
      (err) => {
        if (err && err.message.includes('duplicate column')) {
          console.log('✓ Column attachment_filename already exists');
          resolve();
        } else if (err && !err.message.includes('duplicate column')) {
          reject(err);
        } else {
          console.log('✓ Added attachment_filename column');
          
          // Add attachment_path column
          db.run(
            `ALTER TABLE complaints ADD COLUMN attachment_path TEXT`,
            (err2) => {
              if (err2 && err2.message.includes('duplicate column')) {
                console.log('✓ Column attachment_path already exists');
                resolve();
              } else if (err2 && !err2.message.includes('duplicate column')) {
                reject(err2);
              } else {
                console.log('✓ Added attachment_path column');
                
                // Add attachment_size column
                db.run(
                  `ALTER TABLE complaints ADD COLUMN attachment_size INTEGER`,
                  (err3) => {
                    if (err3 && err3.message.includes('duplicate column')) {
                      console.log('✓ Column attachment_size already exists');
                      resolve();
                    } else if (err3 && !err3.message.includes('duplicate column')) {
                      reject(err3);
                    } else {
                      console.log('✓ Added attachment_size column');
                      
                      // Add attachment_type column
                      db.run(
                        `ALTER TABLE complaints ADD COLUMN attachment_type TEXT`,
                        (err4) => {
                          if (err4 && err4.message.includes('duplicate column')) {
                            console.log('✓ Column attachment_type already exists');
                            resolve();
                          } else if (err4 && !err4.message.includes('duplicate column')) {
                            reject(err4);
                          } else {
                            console.log('✓ Added attachment_type column');
                            resolve();
                          }
                        }
                      );
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  });
};