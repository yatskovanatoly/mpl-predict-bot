export const parseScore = (input: string): string => {
	// Normalize text:
	// - lowercase
	// - replace words like "vs", "to", "and" with a dash
	// - replace all separators (colon, comma, dot, multiple spaces, etc.) with a dash
	const normalized = input
		.toLowerCase()
		.replace(/[^0-9]+/g, '-') // everything not a digit → dash
		.replace(/-+/g, '-') // collapse multiple dashes
		.replace(/^-|-$/g, '') // trim leading/trailing dashes

	// Split by dash into number parts
	const parts = normalized.split('-').filter(Boolean)

	// Need at least 2 numbers to form a score
	if (parts.length < 2) return ''

	// Take the first 2 numbers
	return `${parts[0]}-${parts[1]}`
}

// Deno.test('parseScore should correctly parse various score formats', () => {
// 	const testCases = [
// 		{ input: '1:66', expected: '1-66' },
// 		{ input: '100:6', expected: '100-6' },
// 		{ input: '2-1', expected: '2-1' },
// 		{ input: ' 3 - 2 ', expected: '3-2' },
// 		{ input: '4,0', expected: '4-0' },
// 		{ input: ' 5 , 5 ', expected: '5-5' },
// 		{ input: '6:3', expected: '6-3' },
// 		{ input: ' 7 : 7 ', expected: '7-7' },
// 		{ input: '8- 9', expected: '8-9' },
// 		{ input: '10 -11', expected: '10-11' },
// 		{ input: '12, 13', expected: '12-13' },
// 		{ input: '14 ,15', expected: '14-15' },
// 		{ input: '16: 17', expected: '16-17' },
// 		{ input: '18 :19', expected: '18-19' },
// 		{ input: '20-21-22', expected: '20-21' },
// 		{ input: '23,24,25', expected: '23-24' },
// 		{ input: '26:27:28', expected: '26-27' },
// 		{ input: 'abc-1-2-def', expected: '1-2' },
// 		{ input: '1x2', expected: '1-2' },
// 		{ input: '1.2', expected: '1-2' },
// 		{ input: '1 2', expected: '1-2' },
// 		{ input: ' - 1 - 2 - ', expected: '1-2' },
// 		{ input: '1 - - 2', expected: '1-2' },
// 		{ input: '1,,2', expected: '1-2' },
// 		{ input: '1::2', expected: '1-2' },
// 		{ input: '   1   -   2   ', expected: '1-2' },
// 		{ input: 'one-two', expected: '' },
// 		{ input: '1 and 2', expected: '1-2' },
// 		{ input: 'score is 1-2', expected: '1-2' },
// 		{ input: '1-2 final', expected: '1-2' },
// 		{ input: '1-2 (penalty)', expected: '1-2' },
// 		{ input: '1-2 extra time', expected: '1-2' },
// 		{ input: '1-2-3-4', expected: '1-2' },
// 		{ input: '1 2 3 4', expected: '1-2' },
// 		{ input: '1,2,3,4', expected: '1-2' },
// 		{ input: '1:2:3:4', expected: '1-2' },
// 		{ input: 'home 1 away 2', expected: '1-2' },
// 		{ input: '1 goals 2 goals', expected: '1-2' },
// 		{ input: '1 to 2', expected: '1-2' },
// 		{ input: '1 vs 2', expected: '1-2' },
// 		{ input: '1: 2', expected: '1-2' },
// 		{ input: '1 :2', expected: '1-2' },
// 		{ input: '1 -2', expected: '1-2' },
// 		{ input: '1- 2', expected: '1-2' },
// 		{ input: '1, 2', expected: '1-2' },
// 		{ input: '1 ,2', expected: '1-2' },
// 		{ input: '1-2-abc', expected: '1-2' },
// 		{ input: 'abc-1-2', expected: '1-2' },
// 		{ input: '1-2def', expected: '1-2' },
// 		{ input: 'abc1-2', expected: '1-2' },
// 		{ input: '1-2- ', expected: '1-2' },
// 		{ input: ' -1-2', expected: '1-2' },
// 		{ input: '1-2-', expected: '1-2' },
// 		{ input: '1-2-3', expected: '1-2' },
// 		{ input: '1-2-3-4-5', expected: '1-2' },
// 		{ input: '1-2-3-4-5-6', expected: '1-2' },
// 		{ input: '1-2-3-4-5-6-7', expected: '1-2' },
// 		{ input: '1-2', expected: '1-2' },
// 		{ input: '1 2', expected: '1-2' },
// 		{ input: '1   2', expected: '1-2' },
// 		{ input: '1-2 3-4', expected: '1-2' },
// 		{ input: '1 2-3 4', expected: '1-2' },
// 		{ input: '1-2 3 4', expected: '1-2' },
// 		{ input: '1 2 3-4', expected: '1-2' },
// 		{ input: '1 2 3 4', expected: '1-2' },
// 		{ input: '1-2-3 4', expected: '1-2' },
// 		{ input: '1 2-3-4', expected: '1-2' },
// 		{ input: '1-2 3-4-5', expected: '1-2' },
// 		{ input: '1-2-3 4-5', expected: '1-2' },
// 		{ input: '1-2-3-4 5', expected: '1-2' },
// 		{ input: '1 2 3 4 5', expected: '1-2' },
// 		{ input: '1-2-3-4-5-6-7-8-9-10', expected: '1-2' },
// 		{ input: '1 2 3 4 5 6 7 8 9 10', expected: '1-2' },
// 		{ input: '1-2-3-4-5-6-7-8-9-10-11-12', expected: '1-2' },
// 		{ input: '1 2 3 4 5 6 7 8 9 10 11 12', expected: '1-2' },
// 		{
// 			input: '1-23-4-',
// 			expected: '1-23',
// 		},
// 		{
// 			input: '1 23 4 5',
// 			expected: '1-23',
// 		},
// 		{
// 			input: '12-3-',
// 			expected: '12-3',
// 		},
// 		{
// 			input: '1 2-3 ',
// 			expected: '1-2',
// 		},
// 		{
// 			input: '1- 21- 3-4',
// 			expected: '1-21',
// 		},
// 		{ input: '1 2', expected: '1-2' },
// 	]

// 	for (const { input, expected } of testCases) {
// 		assertEquals(parseScore(input), expected)
// 		console.log(
// 			'input:',
// 			input,
// 			'parsed:',
// 			parseScore(input),
// 			'expected:',
// 			expected
// 		)
// 	}
// })
