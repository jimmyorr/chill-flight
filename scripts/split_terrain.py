import re
import sys

def main():
    with open('terrain.js', 'r') as f:
        lines = f.readlines()
        
    geometry_lines = lines[:3812]
    chunks_lines = lines[3812:]
    
    # Convert top-level const/let to var for geometry so chunks can see them
    for i in range(len(geometry_lines)):
        line = geometry_lines[i]
        if line.startswith('const '):
            geometry_lines[i] = 'var ' + line[6:]
        elif line.startswith('let '):
            geometry_lines[i] = 'var ' + line[4:]

    # For chunks, convert top-level const/let to var too just in case game.js needs them
    for i in range(len(chunks_lines)):
        line = chunks_lines[i]
        if line.startswith('const '):
            chunks_lines[i] = 'var ' + line[6:]
        elif line.startswith('let '):
            chunks_lines[i] = 'var ' + line[4:]

    with open('terrain-geometry.js', 'w') as f:
        f.writelines(geometry_lines)
        
    with open('terrain-chunks.js', 'w') as f:
        f.writelines(chunks_lines)

if __name__ == '__main__':
    main()
