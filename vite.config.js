import { defineConfig } from 'vite';

export default defineConfig({
  // Base public path when served in production (set to '/' for root)
  base: '/', 

  build: {
    // Output directory for production build
    outDir: 'dist',
    
    // Enable minification
    minify: 'terser',
    
    // Generate source maps for debugging
    sourcemap: true,
    
    // Rollup options for chunking
    rollupOptions: {
      output: {
        // Separate chunks for vendor libraries
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },

  // Development server configuration
  server: {
    port: 8080,
    open: true,
  },

  // Preview server (for testing production build)
  preview: {
    port: 8080,
  },
});
