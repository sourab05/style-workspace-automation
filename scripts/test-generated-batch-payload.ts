/**
 * Test Generated Batch Payload with API
 * Generates a fresh batch payload using the fixed property path logic and tests API upload
 */

import { generateVariantPayload } from '../src/matrix/generator';
import { StudioClient } from '../src/api/studioClient';
import { ENV } from '../src/utils/env';
import { BatchTokenMerger } from '../wdio/utils/batch-token-merger';

// Simulate the property path selection with fixed logic
function pickPropertyPathForType(widget: string, tokenType: string): string[] {
    // Button widget mappings
    if (widget === 'button') {
        switch (tokenType) {
            case 'color':
                return ['background', 'color'];
                // For button, the RN/Studio payload expects `background`, not
                // `background-color`. Using `background-color` here produced a
                // payload shape like:
                //   "primary": { "background-color": { value: ... } }
                // which does not get applied. The correct format is:
                //   "primary": { "background": { value: ... } }
            case 'spacer':
                return ['padding'];
            case 'border-width':
                return ['border', 'width'];
            case 'border-style':
                return ['border', 'style'];
            case 'border-radius':
            case 'radius':
                return ['border', 'radius'];
            case 'box-shadow':
            case 'elevation':
                return ['box-shadow'];
            case 'opacity':
                return ['opacity'];
            default:
                return ['background-color'];
        }
    }

    // Accordion widget mappings
    if (widget === 'accordion') {
        switch (tokenType) {
            case 'color':
                return ['background-color', 'color'];
            case 'font':
                return ['text', 'font-size'];
            case 'space':
                return ['padding'];
            case 'border-width':
                return ['border', 'width'];
            default:
                return ['background-color'];
        }
    }

    return ['background-color'];
}

async function testGeneratedBatchPayload() {
    console.log('🧪 Testing Generated Batch Payload with API\n');
    console.log('='.repeat(80));

    try {
        // Step 1: Generate a sample batch payload
        console.log('\n📦 Step 1: Generating sample batch payload...');

        const buttonPairs = [
            {
                tokenRef: '{color.primary.@.value}',
                item: { widget: 'button', appearance: 'filled', variant: 'primary', state: 'default', tokenType: 'color' },
                propertyPath: pickPropertyPathForType('button', 'color'),
                tokenType: 'color'
            },
            {
                tokenRef: '{font.size.large.value}',
                item: { widget: 'button', appearance: 'filled', variant: 'primary', state: 'hover', tokenType: 'font' },
                propertyPath: pickPropertyPathForType('button', 'font'),
                tokenType: 'font'
            },
            {
                tokenRef: '{space.4.value}',
                item: { widget: 'button', appearance: 'outlined', variant: 'secondary', state: 'default', tokenType: 'space' },
                propertyPath: pickPropertyPathForType('button', 'space'),
                tokenType: 'space'
            },
            {
                tokenRef: '{border.width.2.value}',
                item: { widget: 'button', appearance: 'outlined', variant: 'secondary', state: 'disabled', tokenType: 'border-width' },
                propertyPath: pickPropertyPathForType('button', 'border-width'),
                tokenType: 'border-width'
            },
            {
                tokenRef: '{opacity.disabled.value}',
                item: { widget: 'button', appearance: 'text', variant: 'tertiary', state: 'disabled', tokenType: 'opacity' },
                propertyPath: pickPropertyPathForType('button', 'opacity'),
                tokenType: 'opacity'
            }
        ];

        const merger = new BatchTokenMerger();
        const buttonPayload = merger.mergePayloads(buttonPairs as any, generateVariantPayload);

        console.log('\nGenerated Button Payload:');
        console.log(JSON.stringify(buttonPayload, null, 2));

        // Verify no invalid properties
        const payloadStr = JSON.stringify(buttonPayload);
        const invalidProps = ['icon-size', 'ripple', 'position'];
        const foundInvalid = invalidProps.filter(prop => payloadStr.includes(prop));

        if (foundInvalid.length > 0) {
            console.log(`\n❌ Found invalid properties: ${foundInvalid.join(', ')}`);
            throw new Error('Payload contains invalid CSS properties');
        }
        console.log('\n✅ No invalid properties found in payload');

        // Step 2: Test with Studio API
        console.log('\n' + '='.repeat(80));
        console.log('\n🔐 Step 2: Authenticating with Studio...');

        const client = new StudioClient({
            baseUrl: ENV.studioBaseUrl,
            projectId: ENV.projectId
        });

        await client.login(
            ENV.studioUsername || '',
            ENV.studioPassword || ''
        );
        console.log('✅ Authentication successful');

        // Step 3: Upload payload
        console.log('\n' + '='.repeat(80));
        console.log('\n📤 Step 3: Uploading generated batch payload to API...');

        try {
            await client.updateComponentOverride('button', buttonPayload);
            console.log('✅ Batch payload accepted by API!');
        } catch (error: any) {
            console.log('❌ Batch payload rejected by API');
            console.log('Error:', error.response?.data || error.message);
            throw error;
        }

        // Step 4: Reset
        console.log('\n🔄 Step 4: Resetting to default state...');
        await client.updateComponentOverride('button', {});
        console.log('✅ Reset complete');

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('\n✅ TEST PASSED!');
        console.log('='.repeat(80));
        console.log('\n📊 Results:');
        console.log('  ✅ Generated batch payload with valid CSS properties');
        console.log('  ✅ No invalid properties (icon-size, ripple, position, etc.)');
        console.log('  ✅ Studio API accepted the batch payload');
        console.log(`  ✅ Tested ${buttonPairs.length} token-variant pairs`);
        console.log('\n✨ Generated batch payloads are working correctly with the API!');

        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testGeneratedBatchPayload();
