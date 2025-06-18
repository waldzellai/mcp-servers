#!/bin/bash

# Intelligent Debugger - Real-time production debugging with Claude Code SDK
# Usage: ./intelligent-debugger.sh [service-name] [--mode live|snapshot] [--fix-probability high|medium|low]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
SERVICE=${1:-"api"}
MODE=${2:-"live"}
FIX_PROBABILITY=${3:-"medium"}
SESSION_FILE=".debug-session-$(date +%Y%m%d)"
DEBUG_DIR="debug-artifacts"

mkdir -p "$DEBUG_DIR"

echo -e "${MAGENTA}🔍 Intelligent Debugger - Claude Code SDK${NC}"
echo "Service: $SERVICE"
echo "Mode: $MODE"

# Initialize debugging session
SESSION_ID=$(claude -p "Initialize debugging session for $SERVICE" \
    --output-format json \
    --system-prompt "You are an expert debugging assistant with deep knowledge of distributed systems, performance optimization, and root cause analysis." \
    2>/dev/null | jq -r '.session_id')

echo "$SESSION_ID" > "$SESSION_FILE"

# Function to collect system state
collect_system_state() {
    local state_file="$DEBUG_DIR/system-state-$(date +%s).json"
    
    {
        echo "{"
        echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",'
        echo '  "cpu": {'
        echo '    "usage": "'$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')'",'
        echo '    "load_average": "'$(uptime | awk -F'load average:' '{print $2}')'"'
        echo '  },'
        echo '  "memory": {'
        echo '    "used": "'$(free -h | awk 'NR==2{print $3}')'",'
        echo '    "available": "'$(free -h | awk 'NR==2{print $7}')'"'
        echo '  },'
        echo '  "disk": {'
        echo '    "usage": "'$(df -h / | awk 'NR==2{print $5}')'"'
        echo '  },'
        echo '  "network": {'
        echo '    "connections": "'$(netstat -an | grep ESTABLISHED | wc -l)'"'
        echo '  }'
        echo "}"
    } > "$state_file"
    
    echo "$state_file"
}

# Function to analyze logs with streaming
analyze_logs_streaming() {
    local log_source=$1
    local analysis_file="$DEBUG_DIR/analysis-$(date +%s).json"
    
    # Create a named pipe for streaming
    PIPE=$(mktemp -u)
    mkfifo "$PIPE"
    
    # Start log streaming in background
    tail -f "$log_source" > "$PIPE" &
    TAIL_PID=$!
    
    # Stream logs to Claude with real-time analysis
    (
        while IFS= read -r line; do
            echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"'$(echo "$line" | sed 's/"/\\"/g')'"}]}}'
        done < "$PIPE"
    ) | claude -p \
        --input-format stream-json \
        --output-format stream-json \
        --resume "$SESSION_ID" \
        --max-turns 100 \
        --system-prompt "Analyze logs in real-time. Detect anomalies, errors, performance issues. When you find a critical issue, output a JSON object with: {\"alert\": true, \"severity\": \"critical|high|medium|low\", \"issue\": \"description\", \"recommendation\": \"action to take\"}" \
        2>/dev/null | while IFS= read -r response; do
            # Parse streaming response
            if echo "$response" | jq -e '.alert == true' >/dev/null 2>&1; then
                SEVERITY=$(echo "$response" | jq -r '.severity')
                ISSUE=$(echo "$response" | jq -r '.issue')
                RECOMMENDATION=$(echo "$response" | jq -r '.recommendation')
                
                # Alert based on severity
                case "$SEVERITY" in
                    "critical")
                        echo -e "\n${RED}🚨 CRITICAL ALERT: $ISSUE${NC}"
                        echo -e "${YELLOW}Recommendation: $RECOMMENDATION${NC}"
                        
                        # Auto-fix if enabled
                        if [[ "$FIX_PROBABILITY" == "high" ]]; then
                            attempt_auto_fix "$ISSUE" "$RECOMMENDATION"
                        fi
                        ;;
                    "high")
                        echo -e "\n${YELLOW}⚠️  HIGH PRIORITY: $ISSUE${NC}"
                        echo -e "Recommendation: $RECOMMENDATION"
                        ;;
                    *)
                        echo -e "\n${BLUE}ℹ️  $SEVERITY: $ISSUE${NC}"
                        ;;
                esac
                
                # Log to file
                echo "$response" >> "$analysis_file"
            fi
        done
    
    # Cleanup
    kill $TAIL_PID 2>/dev/null || true
    rm -f "$PIPE"
}

# Function to attempt auto-fix
attempt_auto_fix() {
    local issue=$1
    local recommendation=$2
    
    echo -e "\n${GREEN}🔧 Attempting auto-fix...${NC}"
    
    FIX_PROMPT=$(cat <<EOF
Based on this issue and recommendation, generate a safe fix script:
Issue: $issue
Recommendation: $recommendation

Requirements:
1. The fix must be reversible
2. Include validation checks
3. Log all actions
4. Create a rollback script

Output as JSON:
{
  "fix_script": "bash commands",
  "rollback_script": "bash commands to undo",
  "validation_commands": ["command1", "command2"],
  "risk_level": "low|medium|high"
}
EOF
)
    
    FIX_RESPONSE=$(claude -p "$FIX_PROMPT" \
        --resume "$SESSION_ID" \
        --output-format json \
        --max-turns 1 \
        2>/dev/null | jq -r '.result' | jq '.')
    
    RISK_LEVEL=$(echo "$FIX_RESPONSE" | jq -r '.risk_level')
    
    # Apply fix based on risk and settings
    if [[ "$RISK_LEVEL" == "low" ]] || [[ "$FIX_PROBABILITY" == "high" ]]; then
        echo -e "${YELLOW}Applying fix (risk: $RISK_LEVEL)...${NC}"
        
        # Save scripts
        echo "$FIX_RESPONSE" | jq -r '.fix_script' > "$DEBUG_DIR/fix-$(date +%s).sh"
        echo "$FIX_RESPONSE" | jq -r '.rollback_script' > "$DEBUG_DIR/rollback-$(date +%s).sh"
        
        # Execute fix
        bash -c "$(echo "$FIX_RESPONSE" | jq -r '.fix_script')"
        
        # Validate
        echo -e "${BLUE}Validating fix...${NC}"
        echo "$FIX_RESPONSE" | jq -r '.validation_commands[]' | while read cmd; do
            if ! bash -c "$cmd"; then
                echo -e "${RED}Validation failed! Rolling back...${NC}"
                bash -c "$(echo "$FIX_RESPONSE" | jq -r '.rollback_script')"
                return 1
            fi
        done
        
        echo -e "${GREEN}✅ Fix applied successfully${NC}"
    else
        echo -e "${YELLOW}Fix available but not applied (risk: $RISK_LEVEL)${NC}"
        echo "To apply manually, check: $DEBUG_DIR/fix-*.sh"
    fi
}

# Function for snapshot debugging
snapshot_debug() {
    echo -e "\n${BLUE}📸 Collecting debug snapshot...${NC}"
    
    # Collect comprehensive system state
    SNAPSHOT_DATA=$(cat <<EOF
{
  "service": "$SERVICE",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "system_state": $(collect_system_state | xargs cat),
  "recent_logs": $(tail -1000 /var/log/$SERVICE.log 2>/dev/null | jq -Rs . || echo '""'),
  "error_logs": $(grep -i error /var/log/$SERVICE.log 2>/dev/null | tail -100 | jq -Rs . || echo '""'),
  "process_info": $(ps aux | grep $SERVICE | jq -Rs . || echo '""'),
  "network_connections": $(netstat -tnp 2>/dev/null | grep $SERVICE | jq -Rs . || echo '""'),
  "container_logs": $(docker logs $SERVICE --tail 1000 2>&1 | jq -Rs . || echo '""')
}
EOF
)
    
    # Analyze snapshot
    ANALYSIS_PROMPT=$(cat <<EOF
Analyze this comprehensive system snapshot and provide:
1. Root cause analysis
2. Performance bottlenecks
3. Security concerns
4. Recommended actions
5. Preventive measures

Format as JSON with detailed findings and actionable recommendations.

Snapshot data:
$SNAPSHOT_DATA
EOF
)
    
    echo -e "${YELLOW}Analyzing snapshot...${NC}\n"
    
    ANALYSIS=$(claude -p "$ANALYSIS_PROMPT" \
        --resume "$SESSION_ID" \
        --output-format json \
        --system-prompt "You are a senior SRE with expertise in debugging production systems. Provide thorough analysis with specific, actionable recommendations." \
        --max-turns 3 \
        2>/dev/null | jq -r '.result' | jq '.')
    
    # Save analysis
    echo "$ANALYSIS" > "$DEBUG_DIR/snapshot-analysis-$(date +%s).json"
    
    # Display key findings
    echo -e "${GREEN}📊 Analysis Complete:${NC}"
    echo "$ANALYSIS" | jq -r '
        "Root Cause: \(.root_cause // "Unknown")",
        "Severity: \(.severity // "Unknown")",
        "",
        "Top Issues:",
        (.issues // [] | map("  - \(.)") | join("\n")),
        "",
        "Recommended Actions:",
        (.recommendations // [] | map("  ✓ \(.)") | join("\n"))
    '
    
    # Generate remediation script
    echo -e "\n${BLUE}Generating remediation script...${NC}"
    
    REMEDIATION=$(claude -p "Based on the analysis, generate a comprehensive remediation script with rollback capability" \
        --resume "$SESSION_ID" \
        --output-format text \
        --max-turns 1)
    
    echo "$REMEDIATION" > "$DEBUG_DIR/remediate-$(date +%s).sh"
    chmod +x "$DEBUG_DIR/remediate-"*.sh
    
    echo -e "${GREEN}✅ Remediation script generated${NC}"
}

# Main execution
case "$MODE" in
    "live")
        echo -e "\n${YELLOW}Starting live debugging...${NC}"
        echo "Press Ctrl+C to stop"
        
        # Start system monitoring in background
        while true; do
            collect_system_state >/dev/null
            sleep 30
        done &
        MONITOR_PID=$!
        
        # Start log analysis
        if [ -f "/var/log/$SERVICE.log" ]; then
            analyze_logs_streaming "/var/log/$SERVICE.log"
        else
            # Try Docker logs
            docker logs -f "$SERVICE" 2>&1 | analyze_logs_streaming -
        fi
        
        # Cleanup
        kill $MONITOR_PID 2>/dev/null || true
        ;;
        
    "snapshot")
        snapshot_debug
        ;;
        
    *)
        echo "Unknown mode: $MODE"
        exit 1
        ;;
esac

# Generate final report
echo -e "\n${BLUE}📝 Generating debug report...${NC}"

REPORT_PROMPT="Generate an executive summary of this debugging session including key findings, actions taken, and recommendations for preventing similar issues."

REPORT=$(claude -p "$REPORT_PROMPT" \
    --resume "$SESSION_ID" \
    --output-format text \
    --max-turns 1)

echo "$REPORT" > "$DEBUG_DIR/debug-report-$(date +%Y%m%d-%H%M%S).md"

echo -e "\n${GREEN}✅ Debugging session complete${NC}"
echo "Artifacts saved in: $DEBUG_DIR/"
echo "Session ID: $SESSION_ID"

# Cleanup old sessions
find . -name ".debug-session-*" -mtime +7 -delete 2>/dev/null || true