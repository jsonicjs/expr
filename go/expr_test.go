/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */

package expr

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"

	jsonic "github.com/jsonicjs/jsonic/go"
)

// specEntry holds one line from a TSV spec file.
type specEntry struct {
	input    string
	expected interface{}
}

// loadSpec reads a TSV spec file and returns parsed entries.
func loadSpec(t *testing.T, name string) []specEntry {
	t.Helper()

	// Find spec dir relative to this test file.
	_, filename, _, _ := runtime.Caller(0)
	specDir := filepath.Join(filepath.Dir(filename), "..", "test", "spec")
	specPath := filepath.Join(specDir, name)

	f, err := os.Open(specPath)
	if err != nil {
		t.Fatalf("failed to open spec file %s: %v", specPath, err)
	}
	defer f.Close()

	var entries []specEntry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		var expected interface{}
		if err := json.Unmarshal([]byte(parts[1]), &expected); err != nil {
			t.Fatalf("failed to parse expected JSON in %s: %q: %v", name, parts[1], err)
		}
		entries = append(entries, specEntry{input: parts[0], expected: expected})
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("error reading spec file %s: %v", name, err)
	}
	return entries
}

// simplifyAndNormalize converts the parse result to simplified form
// and normalizes it to match JSON-parsed expected values.
func simplifyAndNormalize(node interface{}) interface{} {
	simplified := Simplify(node)
	// Round-trip through JSON to normalize types (float64 for numbers, etc.)
	b, err := json.Marshal(simplified)
	if err != nil {
		return simplified
	}
	var normalized interface{}
	if err := json.Unmarshal(b, &normalized); err != nil {
		return simplified
	}
	return normalized
}

// runSpec runs all entries from a TSV spec file against a jsonic instance.
func runSpec(t *testing.T, specName string, j *jsonic.Jsonic) {
	t.Helper()
	entries := loadSpec(t, specName)
	for _, e := range entries {
		t.Run(e.input, func(t *testing.T) {
			result, err := j.Parse(e.input)
			if err != nil {
				t.Fatalf("parse error for %q: %v", e.input, err)
			}
			got := simplifyAndNormalize(result)
			if !reflect.DeepEqual(got, e.expected) {
				gotJSON, _ := json.Marshal(got)
				expJSON, _ := json.Marshal(e.expected)
				t.Errorf("input: %q\n  got:  %s\n  want: %s", e.input, gotJSON, expJSON)
			}
		})
	}
}

func makeExprJsonic(opOpts ...map[string]interface{}) *jsonic.Jsonic {
	j := jsonic.Make()
	var opts map[string]interface{}
	if len(opOpts) > 0 {
		opts = opOpts[0]
	}
	j.Use(Expr, opts)
	return j
}

func TestSpecHappy(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "happy.tsv", j)
}

func TestSpecBinary(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "binary.tsv", j)
}

func TestSpecStructure(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "structure.tsv", j)
}

func TestSpecUnaryPrefixBasic(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "unary-prefix-basic.tsv", j)
}

func TestSpecUnaryPrefixEdge(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"at": map[string]interface{}{
				"prefix": true, "right": 15000, "src": "@",
			},
			"tight": map[string]interface{}{
				"infix": true, "left": 120000, "right": 130000, "src": "~",
			},
		},
	})
	runSpec(t, "unary-prefix-edge.tsv", j)
}

func TestSpecUnarySuffixBasic(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"question": map[string]interface{}{
				"suffix": true, "left": 13000, "src": "?",
			},
		},
	})
	runSpec(t, "unary-suffix-basic.tsv", j)
}

func TestSpecUnarySuffixEdge(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"question": map[string]interface{}{
				"suffix": true, "left": 13000, "src": "?",
			},
			"tight": map[string]interface{}{
				"infix": true, "left": 120000, "right": 130000, "src": "~",
			},
		},
	})
	runSpec(t, "unary-suffix-edge.tsv", j)
}

func TestSpecUnarySuffixStructure(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"question": map[string]interface{}{
				"suffix": true, "left": 13000, "src": "?",
			},
		},
	})
	runSpec(t, "unary-suffix-structure.tsv", j)
}

func TestSpecUnarySuffixPrefix(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"question": map[string]interface{}{
				"suffix": true, "left": 13000, "src": "?",
			},
		},
	})
	runSpec(t, "unary-suffix-prefix.tsv", j)
}

func TestSpecUnarySuffixParen(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"question": map[string]interface{}{
				"suffix": true, "left": 13000, "src": "?",
			},
		},
	})
	runSpec(t, "unary-suffix-paren.tsv", j)
}

func TestSpecParenBasic(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-basic.tsv", j)
}

func TestSpecImplicitListTopBasic(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "implicit-list-top-basic.tsv", j)
}

func TestSpecTernaryBasic(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "src": "!", "left": 15000,
			},
			"ternary": map[string]interface{}{
				"ternary": true, "src": []interface{}{"?", ":"},
			},
		},
	})
	runSpec(t, "ternary-basic.tsv", j)
}

func TestTernaryBasicImplicitList(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "src": "!", "left": 15000,
			},
			"ternary": map[string]interface{}{
				"ternary": true, "src": []interface{}{"?", ":"},
			},
		},
	})

	tests := []struct {
		input    string
		expected interface{}
	}{
		// Top-level implicit lists with ternary.
		{"a 1?2:3", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}},
		{"1?2:3 b", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		{"a 1?2:3 b", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		{"a,1?2:3", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}},
		{"1?2:3,b", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		{"a,1?2:3,b", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		// Inside parens.
		{"(a 1?2:3)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"(1?2:3 b)", []interface{}{"(", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"(a 1?2:3 b)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"(a,1?2:3)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"(1?2:3,b)", []interface{}{"(", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"(a,1?2:3,b)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := j.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error for %q: %v", tt.input, err)
			}
			got := simplifyAndNormalize(result)
			if !reflect.DeepEqual(got, tt.expected) {
				gotJSON, _ := json.Marshal(got)
				expJSON, _ := json.Marshal(tt.expected)
				t.Errorf("got:  %s\nwant: %s", gotJSON, expJSON)
			}
		})
	}
}

func TestSpecJSONBase(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "json-base.tsv", j)
}

func TestSpecParenImplicitMap(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-implicit-map.tsv", j)
}

func TestSpecJsonicBase(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "jsonic-base.tsv", j)
}

func TestSpecImplicitListTopParen(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "implicit-list-top-paren.tsv", j)
}

func TestSpecParenImplicitList(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-implicit-list.tsv", j)
}

func TestSpecMapImplicitListParen(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "map-implicit-list-paren.tsv", j)
}

func TestSpecParenListImplicitStructureComma(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-list-implicit-structure-comma.tsv", j)
}

func TestSpecParenListImplicitStructureSpace(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-list-implicit-structure-space.tsv", j)
}

func TestSpecParenMapImplicitStructureComma(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-map-implicit-structure-comma.tsv", j)
}

func TestSpecParenMapImplicitStructureSpace(t *testing.T) {
	j := makeExprJsonic()
	runSpec(t, "paren-map-implicit-structure-space.tsv", j)
}

func TestSpecAddInfix(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"foo": map[string]interface{}{
				"infix": true, "left": 180, "right": 190, "src": "foo",
			},
		},
	})
	runSpec(t, "add-infix.tsv", j)
}

// TestSimplify verifies the Simplify function.
func TestSimplify(t *testing.T) {
	op := &Op{Name: "addition-infix", Src: "+", Infix: true}
	expr := []interface{}{op, 1.0, 2.0}
	got := Simplify(expr)

	expected := []interface{}{"+", 1.0, 2.0}
	if !reflect.DeepEqual(got, expected) {
		t.Errorf("Simplify: got %v, want %v", got, expected)
	}
}

// TestEvaluation verifies basic evaluation.
func TestEvaluation(t *testing.T) {
	mathResolve := func(r *jsonic.Rule, ctx *jsonic.Context, op *Op, terms []interface{}) interface{} {
		switch op.Name {
		case "addition-infix":
			return toFloat(terms[0]) + toFloat(terms[1])
		case "subtraction-infix":
			return toFloat(terms[0]) - toFloat(terms[1])
		case "multiplication-infix":
			return toFloat(terms[0]) * toFloat(terms[1])
		case "negative-prefix":
			return -1 * toFloat(terms[0])
		case "positive-prefix":
			return toFloat(terms[0])
		case "plain-paren":
			if len(terms) > 0 {
				return terms[0]
			}
			return nil
		default:
			return nil
		}
	}

	j := jsonic.Make()
	j.Use(Expr, nil)

	tests := []struct {
		input    string
		expected float64
	}{
		{"1+2", 3},
		{"1+2+3", 6},
		{"1*2+3", 5},
		{"1+2*3", 7},
		{"(1+2)*3", 9},
		{"3*(1+2)", 9},
		{"(1)", 1},
		{"(1+2)", 3},
		{"3+(1+2)", 6},
		{"(1+2)+3", 6},
		{"111+222", 333},
		{"(111+222)", 333},
		{"111+(222)", 333},
		{"(111)+222", 333},
		{"(111)+(222)", 333},
		{"(1+2)*4", 12},
		{"1+(2*4)", 9},
		{"((1+2)*4)", 12},
		{"(1+(2*4))", 9},
		{"((114))", 114},
		{"(((115)))", 115},
		{"1-3", -2},
		{"-1", -1},
		{"+1", 1},
		{"1+(-3)", -2},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := j.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error: %v", err)
			}
			val := Evaluation(nil, nil, result, mathResolve)
			if got := toFloat(val); got != tt.expected {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func toFloat(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

// TestParseConvenience tests the Parse convenience function.
func TestParseConvenience(t *testing.T) {
	result, err := Parse("1+2")
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	got := simplifyAndNormalize(result)
	expected := []interface{}{"+", float64(1), float64(2)}
	expectedJSON, _ := json.Marshal(expected)
	gotJSON, _ := json.Marshal(got)
	if string(gotJSON) != string(expectedJSON) {
		t.Errorf("got %s, want %s", gotJSON, expectedJSON)
	}
	_ = fmt.Sprintf("") // use fmt
}

// TestEvaluateSets verifies set union/intersection evaluation with custom operators.
func TestEvaluateSets(t *testing.T) {
	setResolve := func(r *jsonic.Rule, ctx *jsonic.Context, op *Op, terms []interface{}) interface{} {
		switch op.Name {
		case "plain-paren":
			if len(terms) > 0 {
				return terms[0]
			}
			return nil
		case "union-infix":
			a := toIntSlice(terms[0])
			b := toIntSlice(terms[1])
			seen := make(map[int]bool)
			var result []int
			for _, v := range a {
				if !seen[v] {
					seen[v] = true
					result = append(result, v)
				}
			}
			for _, v := range b {
				if !seen[v] {
					seen[v] = true
					result = append(result, v)
				}
			}
			sortInts(result)
			return intsToInterface(result)
		case "intersection-infix":
			a := toIntSlice(terms[0])
			b := toIntSlice(terms[1])
			setA := make(map[int]bool)
			for _, v := range a {
				setA[v] = true
			}
			var result []int
			seen := make(map[int]bool)
			for _, v := range b {
				if setA[v] && !seen[v] {
					seen[v] = true
					result = append(result, v)
				}
			}
			sortInts(result)
			return intsToInterface(result)
		default:
			return []interface{}{}
		}
	}

	j := jsonic.Make()
	j.Use(Expr, map[string]interface{}{
		"op": map[string]interface{}{
			"union": map[string]interface{}{
				"infix": true, "src": "U", "left": 140, "right": 150,
			},
			"intersection": map[string]interface{}{
				"infix": true, "src": "N", "left": 140, "right": 150,
			},
		},
	})

	tests := []struct {
		input    string
		expected []int
	}{
		{"[1]U[2]", []int{1, 2}},
		{"[1,3]U[1,2]", []int{1, 2, 3}},
		{"[1,3]N[1,2]", []int{1}},
		{"[1,3]N[2]", []int{}},
		{"[1,3]N[2,1]", []int{1}},
		{"[1,3]N[2]U[1,2]", []int{1, 2}},
		{"[1,3]N([2]U[1,2])", []int{1}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := j.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error for %q: %v", tt.input, err)
			}
			val := Evaluation(nil, nil, result, setResolve)
			got := toIntSlice(val)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func toIntSlice(v interface{}) []int {
	switch s := v.(type) {
	case []interface{}:
		result := make([]int, 0, len(s))
		for _, el := range s {
			result = append(result, int(toFloat(el)))
		}
		return result
	case []int:
		return s
	default:
		return []int{}
	}
}

func intsToInterface(nums []int) []interface{} {
	result := make([]interface{}, len(nums))
	for i, n := range nums {
		result[i] = float64(n)
	}
	return result
}

func sortInts(a []int) {
	for i := 0; i < len(a); i++ {
		for j := i + 1; j < len(a); j++ {
			if a[j] < a[i] {
				a[i], a[j] = a[j], a[i]
			}
		}
	}
}

// TestExampleDotpath verifies custom dot-path operator with evaluation.
func TestExampleDotpath(t *testing.T) {
	// Go's makeAllOps appends "-infix"/"-prefix" to the user-provided name,
	// so "dot" becomes "dot-infix" and "dot-prefix" respectively.
	dotResolve := func(r *jsonic.Rule, ctx *jsonic.Context, op *Op, terms []interface{}) interface{} {
		switch op.Name {
		case "dot-infix":
			parts := make([]string, len(terms))
			for i, term := range terms {
				parts[i] = fmt.Sprintf("%v", term)
			}
			return strings.Join(parts, "/")
		case "dotpre-prefix":
			return "/" + fmt.Sprintf("%v", terms[0])
		case "plain-paren":
			if len(terms) > 0 {
				return terms[0]
			}
			return nil
		case "positive-prefix":
			return terms[0]
		case "addition-infix":
			return toFloat(terms[0]) + toFloat(terms[1])
		default:
			return nil
		}
	}

	j := jsonic.Make()
	j.Use(Expr, map[string]interface{}{
		"op": map[string]interface{}{
			"dot": map[string]interface{}{
				"src": ".", "infix": true, "left": 15000000, "right": 14000000,
			},
			"dotpre": map[string]interface{}{
				"src": ".", "prefix": true, "right": 14000000,
			},
		},
	})

	tests := []struct {
		input    string
		expected interface{}
	}{
		{"a.b", "a/b"},
		{"a.b.c", "a/b/c"},
		{"a.b.c.d", "a/b/c/d"},
		{".a", "/a"},
		{".a.b", "/a/b"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := j.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error: %v", err)
			}
			val := Evaluation(nil, nil, result, dotResolve)
			if val != tt.expected {
				t.Errorf("got %v, want %v", val, tt.expected)
			}
		})
	}
}

func TestSpecPrevalBasic(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"angle": map[string]interface{}{
				"osrc": "<", "csrc": ">", "paren": true,
				"preval": map[string]interface{}{"active": true},
			},
		},
	})
	runSpec(t, "paren-preval-basic.tsv", j)
}

func TestSpecPrevalOverload(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"factorial": map[string]interface{}{
				"suffix": true, "left": 15000, "src": "!",
			},
			"square": map[string]interface{}{
				"osrc": "[", "csrc": "]", "paren": true,
				"preval": map[string]interface{}{"required": true},
			},
			"brace": map[string]interface{}{
				"osrc": "{", "csrc": "}", "paren": true,
				"preval": map[string]interface{}{"required": true},
			},
		},
	})
	runSpec(t, "paren-preval-overload.tsv", j)
}

func TestSpecPrevalImplicit(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"plain": map[string]interface{}{
				"paren": true, "osrc": "(", "csrc": ")",
				"preval": map[string]interface{}{"active": true},
			},
		},
	})
	runSpec(t, "paren-preval-implicit.tsv", j)
}

func TestSpecAddParen(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"angle": map[string]interface{}{
				"paren": true, "osrc": "<", "csrc": ">",
			},
		},
	})
	runSpec(t, "add-paren.tsv", j)
}

func TestTernaryMany(t *testing.T) {
	// Two ternary operators.
	j0 := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"foo": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"?", ":"},
			},
			"bar": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"QQ", "CC"},
			},
		},
	})

	tests0 := []struct {
		input    string
		expected interface{}
	}{
		{"a:1", map[string]interface{}{"a": float64(1)}},
		{"1?2:3", []interface{}{"?", float64(1), float64(2), float64(3)}},
		{"1QQ2CC3", []interface{}{"QQ", float64(1), float64(2), float64(3)}},
		{"1QQ2?4:5CC3", []interface{}{"QQ", float64(1), []interface{}{"?", float64(2), float64(4), float64(5)}, float64(3)}},
		{"1?2QQ4CC5:3", []interface{}{"?", float64(1), []interface{}{"QQ", float64(2), float64(4), float64(5)}, float64(3)}},
	}

	for _, tt := range tests0 {
		t.Run("j0/"+tt.input, func(t *testing.T) {
			result, err := j0.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error: %v", err)
			}
			got := simplifyAndNormalize(result)
			if !reflect.DeepEqual(got, tt.expected) {
				gotJSON, _ := json.Marshal(got)
				expJSON, _ := json.Marshal(tt.expected)
				t.Errorf("got: %s\nwant: %s", gotJSON, expJSON)
			}
		})
	}

	// Three ternary operators.
	j1 := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"foo": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"?", ":"},
			},
			"bar": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"QQ", "CC"},
			},
			"zed": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"%%", "@@"},
			},
		},
	})

	tests1 := []struct {
		input    string
		expected interface{}
	}{
		{"a:1", map[string]interface{}{"a": float64(1)}},
		{"1?2:3", []interface{}{"?", float64(1), float64(2), float64(3)}},
		{"1QQ2CC3", []interface{}{"QQ", float64(1), float64(2), float64(3)}},
		{"1%%2@@3", []interface{}{"%%", float64(1), float64(2), float64(3)}},
	}

	for _, tt := range tests1 {
		t.Run("j1/"+tt.input, func(t *testing.T) {
			result, err := j1.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error: %v", err)
			}
			got := simplifyAndNormalize(result)
			if !reflect.DeepEqual(got, tt.expected) {
				gotJSON, _ := json.Marshal(got)
				expJSON, _ := json.Marshal(tt.expected)
				t.Errorf("got: %s\nwant: %s", gotJSON, expJSON)
			}
		})
	}
}

func TestTernaryParenPreval(t *testing.T) {
	j := makeExprJsonic(map[string]interface{}{
		"op": map[string]interface{}{
			"ternary": map[string]interface{}{
				"ternary": true,
				"src":     []interface{}{"?", ":"},
			},
			"plain": map[string]interface{}{
				"paren": true, "osrc": "(", "csrc": ")",
				"preval": map[string]interface{}{},
			},
		},
	})

	tests := []struct {
		input    string
		expected interface{}
	}{
		{"a:1", map[string]interface{}{"a": float64(1)}},
		{"1?2:3", []interface{}{"?", float64(1), float64(2), float64(3)}},

		{"a 1?2:3", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}},
		{"a 1?2:3 b", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		{"1?2:3 b", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},
		{"1?2:3,b", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},

		{"a,1?2:3", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}},
		{"a,1?2:3,b", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}},

		{"(1?2:3)", []interface{}{"(", []interface{}{"?", float64(1), float64(2), float64(3)}}},
		{"(1?2:3 b)", []interface{}{"(", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"(1?2:3,b)", []interface{}{"(", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"(a 1?2:3)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"(a 1?2:3 b)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},

		{"(a,1?2:3)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"(a,1?2:3,b)", []interface{}{"(", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},

		{"foo(a 1?2:3)", []interface{}{"(", "foo", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"foo(1?2:3 b)", []interface{}{"(", "foo", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"foo(a 1?2:3 b)", []interface{}{"(", "foo", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},

		{"foo(a,1?2:3)", []interface{}{"(", "foo", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}}}},
		{"foo(1?2:3,b)", []interface{}{"(", "foo", []interface{}{[]interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
		{"foo(a,1?2:3,b)", []interface{}{"(", "foo", []interface{}{"a", []interface{}{"?", float64(1), float64(2), float64(3)}, "b"}}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result, err := j.Parse(tt.input)
			if err != nil {
				t.Fatalf("parse error for %q: %v", tt.input, err)
			}
			got := simplifyAndNormalize(result)
			if !reflect.DeepEqual(got, tt.expected) {
				gotJSON, _ := json.Marshal(got)
				expJSON, _ := json.Marshal(tt.expected)
				t.Errorf("got:  %s\nwant: %s", gotJSON, expJSON)
			}
		})
	}
}
