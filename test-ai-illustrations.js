// Debug script to test AI illustrations feature
// Run this in the browser console while reading a book

(async function testAIIllustrations() {
  console.log('🧪 Testing AI Illustrations Feature...');
  
  try {
    // Check if we're in the reader
    const pageArea = document.getElementById('page-area');
    if (!pageArea) {
      console.log('❌ Not in reader view. Please open a book first.');
      return;
    }
    
    // Check if AI service is available
    if (typeof window.aiIllustrationService === 'undefined') {
      console.log('⚠️  AI service not exposed globally. Checking internal state...');
    }
    
    // Check configuration
    const isEnabled = localStorage.getItem('aiIllustrationsEnabled') === 'yes';
    console.log('📋 Configuration:');
    console.log('  - Enabled:', isEnabled);
    console.log('  - Frequency:', localStorage.getItem('aiIllustrationsFrequency') || 'every-second-page');
    console.log('  - Quality:', localStorage.getItem('aiIllustrationsQuality') || 'standard');
    
    // Check for existing illustrations
    const illustrations = document.querySelectorAll('figure[data-ai-illustration]');
    console.log('🖼️  Found', illustrations.length, 'existing AI illustrations on current page');
    
    // Check if we can access the service through React components
    const reactFiberKey = Object.keys(pageArea).find(key => key.startsWith('__reactFiber'));
    if (reactFiberKey) {
      console.log('⚛️  React fiber found, AI service should be accessible');
    }
    
    // Test API key presence (without exposing it)
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const testResult = await ipcRenderer.invoke('ai-generate-prompt', {
          locationKey: 'test-location',
          text: 'This is a test to check if API key is configured.'
        });
        
        if (testResult.success) {
          console.log('✅ API key is configured and working');
        } else if (testResult.error && testResult.error.includes('API key')) {
          console.log('🔑 API key not configured. Please set it in settings.');
        } else {
          console.log('⚠️  API test failed:', testResult.error);
        }
      } catch (error) {
        console.log('❌ API test error:', error.message);
      }
    }
    
    // Instructions
    console.log('\n📖 How to test:');
    console.log('1. Make sure AI illustrations are enabled in settings');
    console.log('2. Set your Hyperbolic API key in settings');
    console.log('3. Navigate through book pages (use arrow keys)');
    console.log('4. Look for illustrations on every second page');
    console.log('5. Check browser console for any error messages');
    
    console.log('\n🔧 Quick enable (if not already enabled):');
    console.log('localStorage.setItem("aiIllustrationsEnabled", "yes");');
    console.log('Then reload the page and reopen the book.');
    
  } catch (error) {
    console.error('❌ Test script error:', error);
  }
})();