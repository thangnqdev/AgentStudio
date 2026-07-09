import type { Message } from '../store/useAppStore';

export async function streamChatCompletion(
  messages: Message[],
  baseUrl: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
  onFinish?: () => void,
  onError?: (error: string) => void,
  model: string = 'gpt-3.5-turbo'
) {
  try {
    const formattedMessages = messages.map((m) => {
      if (!m.attachments || m.attachments.length === 0) {
        return {
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        };
      }

      const contentParts: any[] = [];
      
      m.attachments.forEach(att => {
        if (att.type === 'image') {
          contentParts.push({ type: 'image_url', image_url: { url: att.data } });
        } else if (att.type === 'text') {
          contentParts.push({ type: 'text', text: `[File: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\`` });
        }
      });
      
      if (m.content) {
        contentParts.push({ type: 'text', text: m.content });
      }

      return {
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: contentParts.length > 0 ? contentParts : m.content,
      };
    });

    const url = baseUrl.endsWith('/') ? baseUrl + 'chat/completions' : baseUrl + '/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body returned from the API.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      buffer += chunkStr;
      
      const lines = buffer.split('\n');
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') {
          // Finished stream
          onFinish?.();
          return;
        }
        
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              onChunk(data.choices[0].delta.content);
            }
          } catch (e) {
            console.warn('Error parsing SSE data chunk', e, dataStr);
          }
        }
      }
    }
    
    onFinish?.();
  } catch (error) {
    if (error instanceof Error) {
      onError?.(error.message);
    } else {
      onError?.('Unknown error occurred');
    }
  }
}

export async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = baseUrl.endsWith('/') ? baseUrl + 'models' : baseUrl + '/models';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data && Array.isArray(data.data)) {
    return data.data.map((m: any) => m.id).filter(Boolean);
  }
  
  if (data && Array.isArray(data.models)) { // Some custom backends might use this
    return data.models.map((m: any) => m.id ?? m.name).filter(Boolean);
  }
  
  // Fallback if the format is just an array of strings or simple objects
  if (Array.isArray(data)) {
    return data.map((m: any) => m.id ?? m.name ?? m).filter(Boolean);
  }

  throw new Error('Định dạng danh sách model không hợp lệ từ server.');
}
