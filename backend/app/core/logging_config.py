"""
Logging configuration for the transcription backend.
"""
import logging
import logging.config
import sys
from pathlib import Path

def setup_logging(debug: bool = False, log_file_path: str = None):
    """
    Set up logging configuration with separate loggers for different components.
    
    Args:
        debug: Enable debug logging
        log_file_path: Optional path to log file
    """
    
    # Base log level
    root_level = "DEBUG" if debug else "INFO"
    
    # Create logs directory if file logging is enabled
    if log_file_path:
        log_dir = Path(log_file_path).parent
        log_dir.mkdir(parents=True, exist_ok=True)
    
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "transcription": {
                "format": "🎵 %(asctime)s [TRANSCRIPTION] %(message)s",
                "datefmt": "%H:%M:%S"
            },
            "simple": {
                "format": "%(levelname)s: %(message)s"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": root_level,
                "formatter": "default",
                "stream": sys.stdout
            },
            "transcription_console": {
                "class": "logging.StreamHandler", 
                "level": "INFO",
                "formatter": "transcription",
                "stream": sys.stdout
            }
        },
        "loggers": {
            # Root logger
            "": {
                "level": root_level,
                "handlers": ["console"],
                "propagate": False
            },
            # Transcription-specific logger
            "transcription": {
                "level": "INFO",
                "handlers": ["transcription_console"],
                "propagate": False
            },
            # Reduce SQLAlchemy noise significantly
            "sqlalchemy": {
                "level": "ERROR",  # Only show errors
                "handlers": ["console"],
                "propagate": False
            },
            "sqlalchemy.engine": {
                "level": "ERROR",  # Only show errors  
                "handlers": ["console"],
                "propagate": False
            },
            "sqlalchemy.dialects": {
                "level": "ERROR",
                "handlers": ["console"], 
                "propagate": False
            },
            "sqlalchemy.pool": {
                "level": "ERROR",
                "handlers": ["console"],
                "propagate": False
            },
            # Keep app loggers at normal levels
            "app": {
                "level": root_level,
                "handlers": ["console"],
                "propagate": False
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False
            },
            "uvicorn.access": {
                "level": "WARNING",  # Reduce access log noise
                "handlers": ["console"],
                "propagate": False
            }
        }
    }
    
    # Add file handler if path specified
    if log_file_path:
        config["handlers"]["file"] = {
            "class": "logging.FileHandler",
            "level": root_level,
            "formatter": "default",
            "filename": log_file_path,
            "mode": "a"
        }
        
        config["handlers"]["transcription_file"] = {
            "class": "logging.FileHandler",
            "level": "INFO", 
            "formatter": "transcription",
            "filename": log_file_path.replace(".log", "_transcription.log"),
            "mode": "a"
        }
        
        # Add file handlers to all loggers
        for logger_config in config["loggers"].values():
            if logger_config.get("handlers"):
                if "transcription_console" in logger_config["handlers"]:
                    logger_config["handlers"].append("transcription_file")
                else:
                    logger_config["handlers"].append("file")
    
    logging.config.dictConfig(config)

def get_transcription_logger() -> logging.Logger:
    """Get the dedicated transcription logger."""
    return logging.getLogger("transcription")