from src.plugins.core import Plugin, PluginAPI
import os

class HelloWorldPlugin(Plugin):
    def __init__(self):
        super().__init__()
        self.name = "Hello World Plugin"
        self.version = "1.0.0"
        self.api = None
    
    def activate(self):
        """Called when the plugin is activated"""
        print(f"{self.name} v{self.version} activated!")
        
        # Show a welcome notification
        if hasattr(self.api, 'ui') and self.api.ui:
            self.api.ui.show_notification(
                title="Hello World Plugin",
                message="Plugin successfully loaded!",
                type="success"
            )
    
    def deactivate(self):
        """Called when the plugin is deactivated"""
        print(f"{self.name} v{self.version} deactivated!")
    
    def get_metadata(self):
        """Return plugin metadata"""
        return {
            "name": self.name,
            "version": self.version,
            "description": "A simple demonstration plugin",
            "author": "Smart File Manager Team"
        }
    
    def process_file(self, file_path):
        """Example file processing method"""
        if not os.path.exists(file_path):
            return {"error": "File not found"}
        
        file_size = os.path.getsize(file_path)
        
        return {
            "message": f"Hello from plugin! Processed file: {file_path}",
            "file_size": file_size,
            "processed_at": "now"
        }