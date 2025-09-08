#!/usr/bin/env node

/**
 * Script to replace all chatService references with customChatService in server routes
 * This ensures no BuddyBoss API fallbacks occur
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/chat.js');

console.log('🔧 Replacing chatService references with customChatService...');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Define replacements to fix BuddyBoss fallbacks
const replacements = [
  // Search methods
  {
    from: /const results = await chatService\.searchMessages\(/g,
    to: 'const results = await customChatService.searchMessages('
  },
  {
    from: /const results = await chatService\.globalSearch\(/g,
    to: 'const results = await customChatService.globalSearch('
  },
  
  // Message operations
  {
    from: /const result = await chatService\.sendMessage\(/g,
    to: 'const result = await customChatService.sendMessage('
  },
  {
    from: /await chatService\.markMessageRead\(/g,
    to: 'await customChatService.markMessageRead('
  },
  {
    from: /const messages = await chatService\.getChatMessages\(/g,
    to: 'const messages = await customChatService.getChatMessages('
  },
  
  // Thread operations
  {
    from: /const result = await chatService\.updateThread\(/g,
    to: 'const result = await customChatService.updateThread('
  },
  {
    from: /const result = await chatService\.deleteThread\(/g,
    to: 'const result = await customChatService.deleteThread('
  },
  {
    from: /const hasAccess = await chatService\.verifyUserAccess\(/g,
    to: 'const hasAccess = await customChatService.verifyUserAccess('
  },
  
  // Chat operations
  {
    from: /await chatService\.deleteArchivedChat\(/g,
    to: 'await customChatService.deleteArchivedChat('
  },
  
  // Group operations
  {
    from: /const result = await chatService\.createGroupMessage\(/g,
    to: 'const result = await customChatService.createGroupMessage('
  },
  
  // Star operations
  {
    from: /const result = await chatService\.starMessage\(/g,
    to: 'const result = await customChatService.starMessage('
  },
  
  // Status operations (if we want to move these to custom as well)
  {
    from: /await chatService\.deleteStatus\(/g,
    to: 'await customChatService.deleteStatus('
  },
  {
    from: /const analytics = await chatService\.getStatusStats\(/g,
    to: 'const analytics = await customChatService.getStatusStats('
  },
  {
    from: /const viewers = await chatService\.getStatusViewers\(/g,
    to: 'const viewers = await customChatService.getStatusViewers('
  }
];

// Apply all replacements
let changeCount = 0;
replacements.forEach(({ from, to }, index) => {
  const matches = content.match(from);
  if (matches) {
    content = content.replace(from, to);
    console.log(`✅ ${index + 1}. Replaced ${matches.length} instances: ${from.source}`);
    changeCount += matches.length;
  }
});

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`🎉 Replacement complete! ${changeCount} total changes made.`);
console.log('🔥 Server routes now use only customChatService - NO BuddyBoss fallbacks!');

if (changeCount === 0) {
  console.log('ℹ️  No changes needed - file may already be updated.');
}
