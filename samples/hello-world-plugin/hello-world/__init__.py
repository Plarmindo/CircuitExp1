from .main import HelloWorldPlugin

def register():
    """Plugin entry point - returns the plugin instance"""
    return HelloWorldPlugin()