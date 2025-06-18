#!/bin/bash

# ADAS Meta Agent - Fixed implementation with proper Claude integration
# Based on "Automated Design of Agentic Systems" (https://arxiv.org/pdf/2408.08435)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DOMAIN=${1:-"code-automation"}
MAX_ITERATIONS=${2:-1}
ARCHIVE_DIR="evolution-archive"
DISCOVERED_DIR="$ARCHIVE_DIR/discovered"

echo -e "${MAGENTA}🤖 ADAS Meta Agent - Fixed Version${NC}"
echo "Domain: $DOMAIN | Iterations: $MAX_ITERATIONS"

# Initialize directories
mkdir -p "$DISCOVERED_DIR"

# Test Claude integration first
test_claude() {
    echo -e "\n${YELLOW}Testing Claude integration...${NC}"
    local test_response=$(echo "Say 'hello'" | claude --print 2>/dev/null || echo "")
    if [[ -n "$test_response" ]]; then
        echo -e "${GREEN}✅ Claude is working${NC}"
        return 0
    else
        echo -e "${RED}❌ Claude is not responding${NC}"
        return 1
    fi
}

# Generate agent design
generate_agent_design() {
    local iteration=$1
    
    echo -e "\n${CYAN}🧠 Generating agent design for iteration $iteration...${NC}"
    
    # Much simpler prompt
    local prompt="Create a novel bash script for $DOMAIN using 'claude --print'. 

Format:
AGENT_NAME: YourAgentName
REASONING: Brief explanation
---SCRIPT_START---
#!/bin/bash
# Your script here
---SCRIPT_END---"

    echo "Querying Claude for agent design..."
    # Remove timeout and simplify prompt
    local response=$(echo "$prompt" | claude --print 2>/dev/null || echo "")
    
    if [[ -z "$response" ]]; then
        echo -e "${RED}Failed to get response from Claude${NC}"
        return 1
    fi
    
    # Parse response
    local agent_name=$(echo "$response" | grep "^AGENT_NAME:" | cut -d' ' -f2- | head -1)
    local reasoning=$(echo "$response" | grep "^REASONING:" | cut -d' ' -f2- | head -1)
    
    # Extract script between markers
    local script=$(echo "$response" | sed -n '/---SCRIPT_START---/,/---SCRIPT_END---/p' | sed '1d;$d')
    
    # Validate extracted data
    if [[ -z "$agent_name" ]]; then
        agent_name="agent-iter${iteration}-$(date +%s)"
    fi
    if [[ -z "$reasoning" ]]; then
        reasoning="AI-generated agent for $DOMAIN"
    fi
    if [[ -z "$script" ]]; then
        echo -e "${YELLOW}No script found in response, generating default...${NC}"
        script="#!/bin/bash
# $agent_name - AI-powered $DOMAIN tool
set -e

echo '🤖 Starting $agent_name...'

# Example functionality using Claude
case \"\$1\" in
    analyze)
        echo 'Analyzing code...'
        find . -name '*.sh' -type f | head -5 | while read file; do
            echo \"Checking: \$file\"
            claude --print \"Analyze this bash script for improvements: \$(head -50 \"\$file\")\"
        done
        ;;
    *)
        echo \"Usage: \$0 {analyze}\"
        exit 1
        ;;
esac"
    fi
    
    # Save agent
    local agent_id="discovered-iter${iteration}-$(date +%s)"
    local agent_path="$DISCOVERED_DIR/${agent_id}.sh"
    
    echo "$script" > "$agent_path"
    chmod +x "$agent_path"
    
    # Save metadata
    cat > "$DISCOVERED_DIR/${agent_id}.meta.json" << EOF
{
  "id": "$agent_id",
  "name": "$agent_name",
  "iteration": $iteration,
  "reasoning": "$reasoning",
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    echo -e "${GREEN}✅ Created agent: $agent_name${NC}"
    echo "Reasoning: $reasoning"
    echo "Saved to: $agent_path"
    
    return 0
}

# Main execution
main() {
    # Test Claude first
    if ! test_claude; then
        echo -e "${RED}Cannot proceed without Claude${NC}"
        exit 1
    fi
    
    # Run iterations
    for i in $(seq 1 $MAX_ITERATIONS); do
        echo -e "\n${YELLOW}=== Iteration $i/$MAX_ITERATIONS ===${NC}"
        
        if generate_agent_design $i; then
            echo -e "${GREEN}Iteration $i completed successfully${NC}"
        else
            echo -e "${RED}Iteration $i failed${NC}"
        fi
        
        # Brief pause between iterations
        sleep 1
    done
    
    echo -e "\n${GREEN}🎉 ADAS run complete!${NC}"
    echo "Generated agents in: $DISCOVERED_DIR"
    
    # Show generated agents
    echo -e "\n${CYAN}Generated Agents:${NC}"
    find "$DISCOVERED_DIR" -name "*.meta.json" -exec jq -r '"\(.name) - \(.reasoning)"' {} \; 2>/dev/null || echo "No agents found"
}

# Execute
main "$@"