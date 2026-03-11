(function() {
  window.AUTH = {
    getPassword: function() {
      const encoded = [98, 101, 114, 105, 118, 101, 108, 101, 110, 97, 64, 49, 50];
      return String.fromCharCode(...encoded);
    },
    
    // Redirect target
    getRedirectUrl: function() {
      return 'vault.html';
    }
  };
})();
