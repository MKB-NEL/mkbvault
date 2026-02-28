// auth.js
// Hardcoded password - stored externally for security
// Password: karekezi@2 (encoded as char codes to avoid plain text)
(function() {
  window.AUTH = {
    // Encoded password - not easily visible
    getPassword: function() {
      // karekezi@2 in char codes
      const encoded = [107, 97, 114, 101, 107, 101, 122, 105, 64, 50];
      return String.fromCharCode(...encoded);
    },
    
    // Redirect target
    getRedirectUrl: function() {
      return 'vault.html';
    }
  };
})();
