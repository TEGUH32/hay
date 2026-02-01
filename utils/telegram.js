const axios = require('axios');

class TelegramBot {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.backupChatId = process.env.TELEGRAM_BACKUP_CHAT_ID || this.chatId;
  }
  
  async sendAlert(message) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        disable_notification: false
      });
      
      return response.data;
    } catch (error) {
      // Silent fail
      console.error('[TELEGRAM ERROR]', error.message);
    }
  }
  
  async sendBackup(encryptedData) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      await axios.post(url, {
        chat_id: this.backupChatId,
        text: `🔐 ENCRYPTED: ${encryptedData}`,
        parse_mode: 'HTML',
        disable_notification: true
      });
    } catch (error) {
      // Silent fail
    }
  }
  
  async sendFile(filename, content) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
      
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('document', content, filename);
      
      await axios.post(url, formData, {
        headers: formData.getHeaders()
      });
    } catch (error) {
      // Silent fail
    }
  }
}

module.exports = new TelegramBot();
