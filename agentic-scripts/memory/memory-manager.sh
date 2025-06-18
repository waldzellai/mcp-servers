#!/bin/bash

# Claude Code Memory Manager - Programmatic memory management
# Usage: ./memory-manager.sh [command] [options]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Memory file locations
PROJECT_MEMORY="./CLAUDE.md"
USER_MEMORY="$HOME/.claude/CLAUDE.md"
BACKUP_DIR=".claude-memory-backups"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to display help
show_help() {
    cat << EOF
${CYAN}Claude Code Memory Manager${NC}

Commands:
  init          Initialize project memory with smart defaults
  add           Add memory programmatically
  update        Update existing memories
  search        Search memories across all contexts
  analyze       Analyze codebase and suggest memories
  sync          Sync memories across projects
  backup        Backup current memories
  restore       Restore memories from backup
  clean         Clean up outdated memories

Options:
  --scope       project|user|all (default: project)
  --format      markdown|json (default: markdown)
  --auto        Auto-approve suggestions

Examples:
  ./memory-manager.sh init
  ./memory-manager.sh add "Always use TypeScript strict mode"
  ./memory-manager.sh analyze --auto
  ./memory-manager.sh search "testing"
EOF
}

# Function to initialize project memory
init_memory() {
    echo -e "${BLUE}🧠 Initializing Claude Code memory...${NC}"
    
    # Analyze project structure
    PROJECT_ANALYSIS=$(find . -type f -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.toml" -o -name "Makefile" -o -name "Dockerfile" | head -20)
    
    # Detect project type and generate appropriate memory
    INIT_PROMPT=$(cat <<EOF
Analyze this project structure and generate a comprehensive CLAUDE.md file with:
1. Project overview and architecture
2. Coding standards and conventions
3. Testing requirements
4. Build and deployment instructions
5. Common tasks and workflows
6. Important warnings or gotchas

Project files:
$PROJECT_ANALYSIS

Also analyze these files if they exist:
- package.json content: $(cat package.json 2>/dev/null | head -50 || echo "Not found")
- README.md content: $(cat README.md 2>/dev/null | head -50 || echo "Not found")
- .gitignore patterns: $(cat .gitignore 2>/dev/null | head -20 || echo "Not found")

Generate a well-structured CLAUDE.md with specific, actionable instructions.
EOF
)
    
    # Generate initial memory
    INITIAL_MEMORY=$(claude -p "$INIT_PROMPT" \
        --output-format text \
        --system-prompt "You are an expert at creating Claude Code memory files. Be specific and actionable.")
    
    # Backup existing if present
    if [ -f "$PROJECT_MEMORY" ]; then
        cp "$PROJECT_MEMORY" "$BACKUP_DIR/CLAUDE.md.$(date +%s).backup"
        echo -e "${YELLOW}Existing memory backed up${NC}"
    fi
    
    # Write new memory
    echo "$INITIAL_MEMORY" > "$PROJECT_MEMORY"
    echo -e "${GREEN}✅ Project memory initialized: $PROJECT_MEMORY${NC}"
    
    # Show preview
    echo -e "\n${CYAN}Preview:${NC}"
    head -20 "$PROJECT_MEMORY"
    echo "..."
}

# Function to add memory
add_memory() {
    local MEMORY_TEXT="$1"
    local SCOPE="${2:-project}"
    
    if [ -z "$MEMORY_TEXT" ]; then
        echo "Error: Memory text required"
        exit 1
    fi
    
    # Determine target file
    case "$SCOPE" in
        project)
            TARGET_FILE="$PROJECT_MEMORY"
            ;;
        user)
            TARGET_FILE="$USER_MEMORY"
            mkdir -p "$(dirname "$USER_MEMORY")"
            ;;
        *)
            echo "Invalid scope: $SCOPE"
            exit 1
            ;;
    esac
    
    echo -e "${BLUE}Adding memory to $SCOPE scope...${NC}"
    
    # Smart categorization
    CATEGORIZE_PROMPT=$(cat <<EOF
Given this memory instruction: "$MEMORY_TEXT"

And this existing memory file:
$(cat "$TARGET_FILE" 2>/dev/null || echo "# Claude Code Memory\n")

Determine:
1. The most appropriate section to add this memory
2. Whether this duplicates or conflicts with existing memories
3. The properly formatted memory entry

Return JSON:
{
  "section": "section name",
  "formatted_entry": "- Memory text with any needed context",
  "conflicts": ["list of conflicting entries"],
  "duplicate": true/false
}
EOF
)
    
    CATEGORY_RESULT=$(claude -p "$CATEGORIZE_PROMPT" \
        --output-format json \
        --max-turns 1 \
        2>/dev/null | jq -r '.result' | jq '.')
    
    DUPLICATE=$(echo "$CATEGORY_RESULT" | jq -r '.duplicate')
    
    if [ "$DUPLICATE" = "true" ]; then
        echo -e "${YELLOW}⚠️  Memory already exists or conflicts detected${NC}"
        echo "Conflicts: $(echo "$CATEGORY_RESULT" | jq -r '.conflicts | join(", ")')"
        return 1
    fi
    
    # Add memory to appropriate section
    SECTION=$(echo "$CATEGORY_RESULT" | jq -r '.section')
    FORMATTED_ENTRY=$(echo "$CATEGORY_RESULT" | jq -r '.formatted_entry')
    
    # Backup before modification
    cp "$TARGET_FILE" "$BACKUP_DIR/$(basename "$TARGET_FILE").$(date +%s).backup"
    
    # Add entry using Claude to maintain formatting
    UPDATE_PROMPT="Add this entry to the '$SECTION' section: $FORMATTED_ENTRY. Maintain proper markdown formatting and structure."
    
    UPDATED_CONTENT=$(cat "$TARGET_FILE" | claude -p "$UPDATE_PROMPT" \
        --output-format text \
        --max-turns 1)
    
    echo "$UPDATED_CONTENT" > "$TARGET_FILE"
    echo -e "${GREEN}✅ Memory added successfully${NC}"
}

# Function to analyze codebase and suggest memories
analyze_codebase() {
    local AUTO_MODE="${1:-false}"
    
    echo -e "${MAGENTA}🔍 Analyzing codebase for memory suggestions...${NC}"
    
    # Collect codebase patterns
    CODEBASE_INFO=$(cat <<EOF
Project structure:
$(find . -type f -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" | head -50)

Common patterns:
$(grep -r "TODO\|FIXME\|HACK" . --include="*.js" --include="*.ts" --include="*.py" 2>/dev/null | head -20 || true)

Configuration files:
$(find . -name "*.config.js" -o -name "*.config.ts" -o -name "config.json" | head -20)

Test files:
$(find . -name "*.test.*" -o -name "*.spec.*" | head -20)

Dependencies:
$(cat package.json 2>/dev/null | jq '.dependencies,.devDependencies' || echo "Not a Node project")
EOF
)
    
    # Generate suggestions
    SUGGEST_PROMPT=$(cat <<EOF
Analyze this codebase information and suggest 5-10 specific, actionable memories for CLAUDE.md:

$CODEBASE_INFO

Current memories (if any):
$(cat "$PROJECT_MEMORY" 2>/dev/null || echo "None")

Suggest memories that would help with:
1. Common development tasks
2. Project-specific conventions
3. Testing and quality standards
4. Performance considerations
5. Security best practices

Format as JSON:
{
  "suggestions": [
    {
      "category": "Development",
      "memory": "Specific instruction",
      "reasoning": "Why this is important",
      "priority": "high|medium|low"
    }
  ]
}
EOF
)
    
    SUGGESTIONS=$(claude -p "$SUGGEST_PROMPT" \
        --output-format json \
        --system-prompt "You are an expert at identifying important project patterns and conventions." \
        --max-turns 1 \
        2>/dev/null | jq -r '.result' | jq '.')
    
    # Display suggestions
    echo -e "\n${CYAN}Memory Suggestions:${NC}"
    echo "$SUGGESTIONS" | jq -r '.suggestions[] | "[\(.priority)] \(.category): \(.memory)"'
    
    if [ "$AUTO_MODE" = "--auto" ]; then
        echo -e "\n${YELLOW}Auto-applying high priority suggestions...${NC}"
        echo "$SUGGESTIONS" | jq -r '.suggestions[] | select(.priority == "high") | .memory' | while read -r memory; do
            add_memory "$memory" "project"
        done
    else
        echo -e "\n${BLUE}To apply these suggestions, run:${NC}"
        echo "  ./memory-manager.sh analyze --auto"
    fi
}

# Function to search memories
search_memories() {
    local SEARCH_TERM="$1"
    
    echo -e "${BLUE}🔍 Searching memories for: $SEARCH_TERM${NC}\n"
    
    # Search in project memory
    if [ -f "$PROJECT_MEMORY" ]; then
        echo -e "${CYAN}Project memories:${NC}"
        grep -i "$SEARCH_TERM" "$PROJECT_MEMORY" --color=always || echo "  No matches"
    fi
    
    # Search in user memory
    if [ -f "$USER_MEMORY" ]; then
        echo -e "\n${CYAN}User memories:${NC}"
        grep -i "$SEARCH_TERM" "$USER_MEMORY" --color=always || echo "  No matches"
    fi
    
    # Search in parent directories
    echo -e "\n${CYAN}Parent directory memories:${NC}"
    current_dir=$(pwd)
    while [ "$current_dir" != "/" ]; do
        current_dir=$(dirname "$current_dir")
        if [ -f "$current_dir/CLAUDE.md" ]; then
            echo "  In $current_dir:"
            grep -i "$SEARCH_TERM" "$current_dir/CLAUDE.md" --color=always || true
        fi
    done
}

# Function to sync memories across projects
sync_memories() {
    echo -e "${MAGENTA}🔄 Syncing memories...${NC}"
    
    # Find all CLAUDE.md files in workspace
    WORKSPACE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    MEMORY_FILES=$(find "$WORKSPACE_ROOT" -name "CLAUDE.md" -type f)
    
    echo "Found memory files:"
    echo "$MEMORY_FILES"
    
    # Extract common patterns
    SYNC_PROMPT=$(cat <<EOF
Analyze these memory files and identify:
1. Common patterns that should be in user memory
2. Project-specific patterns that should stay local
3. Conflicts or inconsistencies

Memory files content:
$(echo "$MEMORY_FILES" | while read -r file; do
    echo "=== $file ==="
    cat "$file"
    echo
done)

Provide recommendations for optimizing memory organization.
EOF
)
    
    SYNC_RECOMMENDATIONS=$(claude -p "$SYNC_PROMPT" \
        --output-format text \
        --max-turns 2)
    
    echo -e "\n${CYAN}Sync Recommendations:${NC}"
    echo "$SYNC_RECOMMENDATIONS"
}

# Function to clean outdated memories
clean_memories() {
    echo -e "${YELLOW}🧹 Cleaning outdated memories...${NC}"
    
    if [ ! -f "$PROJECT_MEMORY" ]; then
        echo "No project memory found"
        return
    fi
    
    # Analyze current codebase state
    CURRENT_STATE=$(find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" \) -exec head -50 {} \; | head -500)
    
    CLEAN_PROMPT=$(cat <<EOF
Review this memory file and identify outdated or irrelevant entries based on current codebase:

Memory file:
$(cat "$PROJECT_MEMORY")

Current codebase sample:
$CURRENT_STATE

Identify:
1. Outdated instructions (referencing old patterns, deprecated libraries)
2. Redundant entries
3. Conflicting instructions
4. Suggested improvements

Return the cleaned memory file content.
EOF
)
    
    # Backup before cleaning
    cp "$PROJECT_MEMORY" "$BACKUP_DIR/CLAUDE.md.$(date +%s).pre-clean.backup"
    
    CLEANED_CONTENT=$(claude -p "$CLEAN_PROMPT" \
        --output-format text \
        --system-prompt "You are an expert at maintaining clean, relevant documentation." \
        --max-turns 1)
    
    echo "$CLEANED_CONTENT" > "$PROJECT_MEMORY"
    echo -e "${GREEN}✅ Memory cleaned and optimized${NC}"
}

# Function to backup memories
backup_memories() {
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local BACKUP_FILE="$BACKUP_DIR/memory-backup-$TIMESTAMP.tar.gz"
    
    echo -e "${BLUE}💾 Backing up memories...${NC}"
    
    # Create backup archive
    tar -czf "$BACKUP_FILE" \
        $([ -f "$PROJECT_MEMORY" ] && echo "$PROJECT_MEMORY") \
        $([ -f "$USER_MEMORY" ] && echo "$USER_MEMORY") \
        $(find . -name "CLAUDE.md" -type f | grep -v "$BACKUP_DIR") \
        2>/dev/null
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
    
    # List recent backups
    echo -e "\n${CYAN}Recent backups:${NC}"
    ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -5
}

# Function to restore memories
restore_memories() {
    local BACKUP_FILE="$1"
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${CYAN}Available backups:${NC}"
        ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null
        echo -e "\n${YELLOW}Usage: $0 restore <backup-file>${NC}"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Error: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    echo -e "${BLUE}📥 Restoring from: $BACKUP_FILE${NC}"
    
    # Extract backup
    tar -xzf "$BACKUP_FILE" -C /
    
    echo -e "${GREEN}✅ Memories restored${NC}"
}

# Main command handler
case "$1" in
    init)
        init_memory
        ;;
    add)
        shift
        add_memory "$@"
        ;;
    analyze)
        shift
        analyze_codebase "$@"
        ;;
    search)
        shift
        search_memories "$@"
        ;;
    sync)
        sync_memories
        ;;
    clean)
        clean_memories
        ;;
    backup)
        backup_memories
        ;;
    restore)
        shift
        restore_memories "$@"
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac