export const KEYWORD_RESPONSES: Record<string, string> = {
  hello: 'Hello! How can I help you today?',
  hi: 'Hi there! What can I do for you?',
  help: 'Sure! I am here to help. What do you need?',
  bye: 'Goodbye! Have a great day!',
  thanks: 'You are welcome!',
  weather: 'I am not connected to weather data, but I hope it is sunny!',
  joke: 'Why do programmers prefer dark mode? Because light attracts bugs!',
  time: 'I do not have access to real-time data, but your device clock knows!',
};

export function generateMockResponse(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return 'Hello! How can I help you?';
  }
  const lower = trimmed.toLowerCase();
  for (const [keyword, response] of Object.entries(KEYWORD_RESPONSES)) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lower)) {
      return response;
    }
  }
  return `You said: "${trimmed}"`;
}
