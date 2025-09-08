const fs = require('fs');
const path = require('path');

const chatRoutesPath = path.join(__dirname, '../routes/chat.js');

console.log('🔧 Starting final chat service reference fixes...');

// Read the file
let content = fs.readFileSync(chatRoutesPath, 'utf8');

// All remaining chatService references to fix
const replacements = [
  // Standard method calls
  { from: 'await chatService.createChat(', to: 'await customChatService.createChat(' },
  { from: 'await chatService.uploadMedia(', to: 'await customChatService.uploadMedia(' },
  { from: 'await chatService.uploadVoiceMessage(', to: 'await customChatService.uploadVoiceMessage(' },
  { from: 'await chatService.archiveChat(', to: 'await customChatService.archiveChat(' },
  { from: 'await chatService.deleteChat', to: 'await customChatService.deleteChat' },
  { from: 'await chatService.createStatus(', to: 'await customChatService.createStatus(' },
  { from: 'await chatService.getUserStatuses(', to: 'await customChatService.getUserStatuses(' },
  { from: 'await chatService.getFriendsStatuses(', to: 'await customChatService.getFriendsStatuses(' },
  { from: 'await chatService.addUserToGroup(', to: 'await customChatService.addUserToGroup(' },
  { from: 'await chatService.removeUserFromGroup(', to: 'await customChatService.removeUserFromGroup(' },
  { from: 'await chatService.getUserFriends(', to: 'await customChatService.getUserFriends(' },
  { from: 'await chatService.getStatusList(', to: 'await customChatService.getStatusList(' },
  { from: 'await chatService.uploadStatusMedia(', to: 'await customChatService.uploadStatusMedia(' },
  { from: 'await chatService.getStatus(', to: 'await customChatService.getStatus(' },
  { from: 'await chatService.markStatusViewed(', to: 'await customChatService.markStatusViewed(' },
  { from: 'await chatService.getStatusViewersNew(', to: 'await customChatService.getStatusViewersNew(' },
  { from: 'await chatService.getStatusAnalytics(', to: 'await customChatService.getStatusAnalytics(' },
  { from: 'await chatService.likeStatus(', to: 'await customChatService.likeStatus(' },
  { from: 'await chatService.getStatusLikes(', to: 'await customChatService.getStatusLikes(' },
  { from: 'await chatService.commentOnStatus(', to: 'await customChatService.commentOnStatus(' },
  { from: 'await chatService.getStatusComments(', to: 'await customChatService.getStatusComments(' },
  { from: 'await chatService.getGroups(', to: 'await customChatService.getGroups(' },
  { from: 'await chatService.createGroup(', to: 'await customChatService.createGroup(' },
  { from: 'await chatService.getGroupMessages(', to: 'await customChatService.getGroupMessages(' },
  { from: 'await chatService.sendGroupMessage(', to: 'await customChatService.sendGroupMessage(' },
  { from: 'await chatService.getClassMetadata(', to: 'await customChatService.getClassMetadata(' },
  { from: 'await chatService.sendGroupMessageCustom(', to: 'await customChatService.sendGroupMessageCustom(' },
  { from: 'await chatService.getGroupMessagesCustom(', to: 'await customChatService.getGroupMessagesCustom(' },
  { from: 'await chatService.deleteGroupMessage(', to: 'await customChatService.deleteGroupMessage(' },
  { from: 'await chatService.deleteGroup(', to: 'await customChatService.deleteGroup(' },
  { from: 'await chatService.getChatGroupsOnly(', to: 'await customChatService.getChatGroupsOnly(' },
  { from: 'await chatService.addClassMetadata(', to: 'await customChatService.addClassMetadata(' },
  { from: 'await chatService.markThreadRead(', to: 'await customChatService.markThreadRead(' },
  { from: 'await chatService.generateLiveClassInvite(', to: 'await customChatService.generateLiveClassInvite(' },
  { from: 'await chatService.joinLiveClassViaInvite(', to: 'await customChatService.joinLiveClassViaInvite(' },
  { from: 'await chatService.getGroupMembers(', to: 'await customChatService.getGroupMembers(' },
  { from: 'await chatService.verifyGroupAdmin(', to: 'await customChatService.verifyGroupAdmin(' },
  { from: 'await chatService.checkUserEnrollment(', to: 'await customChatService.checkUserEnrollment(' }
];

let changeCount = 0;

// Apply all replacements
replacements.forEach(replacement => {
  const regex = new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  if (matches) {
    content = content.replace(regex, replacement.to);
    changeCount += matches.length;
    console.log(`✅ Replaced ${matches.length} instances of: ${replacement.from}`);
  }
});

// Write the updated content
fs.writeFileSync(chatRoutesPath, content);

console.log(`🎉 Final fixes complete! ${changeCount} total changes made.`);
console.log('🔥 All chat routes now use customChatService - NO BuddyBoss fallbacks!');
