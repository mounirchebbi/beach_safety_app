#!/usr/bin/env python3
import os
import re
import unicodedata

def remove_emojis(text):
    """Remove emoji characters from text"""
    # Remove emoji characters (Unicode emoji ranges)
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "]+", flags=re.UNICODE
    )
    return emoji_pattern.sub('', text)

def process_file(file_path):
    """Process a single file to remove emojis"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove emojis
        cleaned_content = remove_emojis(content)
        
        # Only write if content changed
        if cleaned_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)
            print(f"Processed: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to process all files"""
    print("Removing emojis from all files...")
    
    # File extensions to process
    extensions = {'.js', '.ts', '.tsx', '.md', '.txt', '.json', '.yml', '.yaml'}
    
    # Directories to exclude
    exclude_dirs = {'node_modules', '.git', 'build', 'dist', 'coverage'}
    
    processed_count = 0
    
    for root, dirs, files in os.walk('.'):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            file_path = os.path.join(root, file)
            
            # Check if file has relevant extension
            if any(file.endswith(ext) for ext in extensions):
                if process_file(file_path):
                    processed_count += 1
    
    print(f"Emoji removal completed! Processed {processed_count} files.")

if __name__ == "__main__":
    main() 