// Script to enable AI illustrations and set API key
// Run this in the browser console while the Koodo Reader app is open

(async function enableAIIllustrations() {
  try {
    console.log('🎨 Enabling AI Illustrations...');
    
    // Import required services
    const { ConfigService } = window.require ? 
      window.require('electron').remote.require('../src/assets/lib/kookit-extra-browser.min') :
      await import('./src/assets/lib/kookit-extra-browser.min');
    
    // Enable AI illustrations
    ConfigService.setReaderConfig('aiIllustrationsEnabled', 'yes');
    ConfigService.setReaderConfig('aiIllustrationsFrequency', 'every-second-page');
    ConfigService.setReaderConfig('aiIllustrationsQuality', 'standard');
    ConfigService.setReaderConfig('aiIllustrationsCacheSize', '100');
    ConfigService.setReaderConfig('aiIllustrationsNotifications', 'yes');
    
    console.log('✅ AI Illustrations enabled successfully!');
    
    // Set API key
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtcmZlZGtvdkBnbWFpbC5jb20iLCJpYXQiOjE3Mzk0NTg2MTh9.M_42ijlTQmEPkprxul3hZc6VwNrj1D_t2PVTtu3yKXM';
    
    if (window.require) {
      // Electron environment
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('ai-set-api-key', { apiKey });
      
      if (result.success) {
        console.log('🔑 API key set successfully!');
      } else {
        console.error('❌ Failed to set API key:', result.error);
      }
    } else {
      console.log('⚠️  Not in Electron environment - API key needs to be set through UI');
    }
    
    console.log('🎉 Setup complete! Reload the page and open a book to see AI illustrations.');
    console.log('📖 Illustrations will appear on every second page as you navigate through the book.');
    
  } catch (error) {
    console.error('❌ Error enabling AI illustrations:', error);
    console.log('💡 Try using the settings UI instead:');
    console.log('   1. Open reader settings (gear icon)');
    console.log('   2. Find "AI Illustrations" section');
    console.log('   3. Toggle "Enable AI illustrations" to ON');
    console.log('   4. Enter your API key and click Save');
  }
})();