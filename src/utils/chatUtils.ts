export const getUserColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp || !timestamp.toDate) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
