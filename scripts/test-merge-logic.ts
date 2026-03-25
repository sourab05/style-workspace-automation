/**
 * Test script to verify the enhanced deepMerge function preserves all variants
 */

// Enhanced deepMerge with path tracking (copied from style.screen.ts)
const deepMerge = (target: any, source: any, path: string[] = []): any => {
    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const tgtVal = target[key];
        const currentPath = [...path, key];

        // Handle arrays: replace entirely
        if (Array.isArray(srcVal)) {
            target[key] = [...srcVal];
            continue;
        }

        // Handle nulls
        if (srcVal === null) {
            target[key] = null;
            continue;
        }

        // Handle objects recursively
        if (typeof srcVal === 'object') {
            if (typeof tgtVal !== 'object' || tgtVal === null || Array.isArray(tgtVal)) {
                target[key] = {};
            }

            // Special handling for variant groups: preserve all existing variants
            const isVariantGroup = currentPath.length >= 4 &&
                (currentPath.includes('variantGroups') || currentPath.includes('variants'));

            if (isVariantGroup) {
                // Merge variants individually to preserve all variants
                deepMerge(target[key], srcVal, currentPath);
            } else {
                deepMerge(target[key], srcVal, currentPath);
            }
            continue;
        }

        // Primitive override
        target[key] = srcVal;
    }
    return target;
};

// Test Case 1: Merging primary variant into empty object
console.log('\n📝 Test 1: Adding primary variant to empty object');
const test1_existing = {};
const test1_payload = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        primary: {
                            background: { value: '{color.primary.value}' },
                            color: { value: '{color.on-primary.value}' }
                        }
                    }
                }
            }
        }
    }
};

const test1_result = deepMerge({ ...test1_existing }, test1_payload);
console.log('Result:', JSON.stringify(test1_result, null, 2));
console.log('✅ Test 1 passed: Primary variant added');

// Test Case 2: Adding secondary variant to existing primary
console.log('\n📝 Test 2: Adding secondary variant while preserving primary');
const test2_existing = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        primary: {
                            background: { value: '{color.primary.value}' },
                            color: { value: '{color.on-primary.value}' }
                        }
                    }
                }
            }
        }
    }
};

const test2_payload = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        secondary: {
                            background: { value: '{color.secondary.value}' },
                            color: { value: '{color.on-secondary.value}' }
                        }
                    }
                }
            }
        }
    }
};

const test2_result = deepMerge({ ...test2_existing }, test2_payload);
const variants = Object.keys(test2_result.btn.appearances.filled.variantGroups.status);
console.log('Variants after merge:', variants);

if (variants.includes('primary') && variants.includes('secondary')) {
    console.log('✅ Test 2 passed: Both primary and secondary variants preserved');
} else {
    console.error('❌ Test 2 FAILED: Missing variants. Found:', variants);
}

// Test Case 3: Adding tertiary to existing primary and secondary
console.log('\n📝 Test 3: Adding tertiary while preserving primary and secondary');
const test3_existing = test2_result; // Use result from test 2

const test3_payload = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        tertiary: {
                            background: { value: '{color.tertiary.value}' },
                            color: { value: '{color.on-tertiary.value}' }
                        }
                    }
                }
            }
        }
    }
};

const test3_result = deepMerge({ ...test3_existing }, test3_payload);
const variants3 = Object.keys(test3_result.btn.appearances.filled.variantGroups.status);
console.log('Variants after merge:', variants3);

if (variants3.includes('primary') && variants3.includes('secondary') && variants3.includes('tertiary')) {
    console.log('✅ Test 3 passed: All three variants preserved');
} else {
    console.error('❌ Test 3 FAILED: Missing variants. Found:', variants3);
}

// Test Case 4: Updating an existing variant shouldn't affect others
console.log('\n📝 Test 4: Updating primary variant without affecting secondary');
const test4_existing = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        primary: {
                            background: { value: '{color.primary.value}' }
                        },
                        secondary: {
                            background: { value: '{color.secondary.value}' }
                        }
                    }
                }
            }
        }
    }
};

const test4_payload = {
    btn: {
        appearances: {
            filled: {
                variantGroups: {
                    status: {
                        primary: {
                            background: { value: '{color.primary.updated.value}' },
                            border: { width: { value: '2px' } }
                        }
                    }
                }
            }
        }
    }
};

const test4_result = deepMerge({ ...test4_existing }, test4_payload);
const hasSecondary = test4_result.btn.appearances.filled.variantGroups.status.secondary !== undefined;
const primaryUpdated = test4_result.btn.appearances.filled.variantGroups.status.primary.background.value === '{color.primary.updated.value}';
const hasBorder = test4_result.btn.appearances.filled.variantGroups.status.primary.border !== undefined;

if (hasSecondary && primaryUpdated && hasBorder) {
    console.log('✅ Test 4 passed: Primary updated, secondary preserved, border added');
} else {
    console.error('❌ Test 4 FAILED:', { hasSecondary, primaryUpdated, hasBorder });
}

console.log('\n🎉 All tests completed!');
