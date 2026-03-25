
import path from 'path';
import { TokenHelper } from '../tests/pages/TokenHelper.page';

async function main() {
    console.log('🔍 Verifying Token CSS Property Mappings...\n');

    const tokensDir = path.join(process.cwd(), 'tokens', 'web');
    const tokenHelper = new TokenHelper(tokensDir);
    const mapping = tokenHelper.getTokenPropertyMapping();

    const stats: Record<string, number> = {};
    const issues: string[] = [];
    let totalTokens = 0;

    console.log('--------------------------------------------------');
    console.log(pad('Token Reference', 60) + ' | ' + pad('Raw Path', 20) + ' | ' + 'Resolved CSS Property');
    console.log('--------------------------------------------------');

    for (const [tokenRef, propertyPath] of Object.entries(mapping)) {
        totalTokens++;

        // Use generic join strategy for verification
        const cssProperty = propertyPath.join('-');

        // Track stats
        stats[cssProperty] = (stats[cssProperty] || 0) + 1;

        // Check for potential issues (Generic Heuristics)

        // 1. Check if we have multi-segment paths other than border
        if (propertyPath.length > 1 && propertyPath[0] !== 'border') {
            issues.push(`⚠️ Multi-segment path found for ${tokenRef}: [${propertyPath}] -> ${cssProperty}`);
        }

        // 2. mismatched semantics
        // Font tokens should map to font properties
        if (tokenRef.includes('{font.') && !cssProperty.includes('font') && !cssProperty.includes('line-height') && !cssProperty.includes('letter-spacing')) {
            issues.push(`⚠️ Font token ${tokenRef} maps to unrelated property: ${cssProperty}`);
        }

        // Size/Space tokens
        if ((tokenRef.includes('size') || tokenRef.includes('space')) && cssProperty === 'background') {
            // background is the default fallback, so this indicates a likely missing mapping
            issues.push(`❌ Size/Space token ${tokenRef} falling back to 'background'`);
        }

        // Color tokens
        if (tokenRef.includes('color') && !cssProperty.toLowerCase().includes('color') && !cssProperty.includes('background') && !cssProperty.includes('fill') && !cssProperty.includes('stroke')) {
            issues.push(`⚠️ Color token ${tokenRef} maps to: ${cssProperty}`);
        }

        // Output detail for all multi-segment or suspicious items
        if (propertyPath.length > 1) {
            console.log(pad(tokenRef, 60) + ' | ' + pad(JSON.stringify(propertyPath), 20) + ' | ' + cssProperty + ' (Multi-segment)');
        }
    }

    console.log('\n--------------------------------------------------');
    console.log('📊 Summary Stats (Count by CSS Property):');
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([prop, count]) => {
        console.log(`${pad(prop, 30)}: ${count}`);
    });

    if (issues.length > 0) {
        console.log('\n⚠️  Potential Issues Found:');
        issues.forEach(i => console.log(i));
        process.exit(1);
    } else {
        console.log('\n✅ No obvious naming mismatches found for border properties.');
    }
}

function pad(str: string, len: number): string {
    if (str.length >= len) return str.substring(0, len - 3) + '...';
    return str + ' '.repeat(len - str.length);
}

main().catch(console.error);
