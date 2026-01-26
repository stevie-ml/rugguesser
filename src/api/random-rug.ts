cat > src/api/random-rug.ts << 'EOF'
export async function getRandomRug() {
  return {
    title: "Example Rug",
    placeText: "Kashan, Iran",
    imageUrl: ""
  };
}
EOF
