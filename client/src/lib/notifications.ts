// Temporary placeholder file to prevent module loading errors
// Notification system was removed

export function sendNotification() {
  return Promise.resolve();
}

export function getNotifications() {
  return [];
}

export const notificationService = {
  sendNotification,
  getNotifications,
  init: () => Promise.resolve(),
  requestPermission: () => Promise.resolve('granted'),
  isSupported: () => false
};