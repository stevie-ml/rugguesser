cat > src/api/debug-pool.ts << 'EOF'
export function getPoolInfo() {
  return {
    poolSize: 0
  };
}
EOF
