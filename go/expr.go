/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */

// Package expr provides a Pratt-parser expression plugin for the jsonic
// JSON parser. It supports infix, prefix, suffix, ternary and paren
// operators with configurable precedence.
//
// Expressions are encoded as LISP-style S-expressions using arrays/slices.
// The operator source string is the first element of the slice.
package expr

import (
	jsonic "github.com/jsonicjs/jsonic/go"
)

// OpDef defines an operator for the expression parser.
type OpDef struct {
	Src     interface{} // string or []string (for ternary)
	OSrc    string
	CSrc    string
	Left    int
	Right   int
	Prefix  bool
	Suffix  bool
	Infix   bool
	Ternary bool
	Paren   bool
	Preval  interface{}
	Use     interface{}
}

// Op is the full operator description available during parsing and evaluation.
type Op struct {
	Name    string
	Src     string
	Left    int
	Right   int
	Prefix  bool
	Suffix  bool
	Infix   bool
	Ternary bool
	Paren   bool
	Terms   int
	Tkn     string
	Tin     int
	OSrc    string
	CSrc    string
	OTkn    string
	OTin    int
	CTkn    string
	CTin    int
	Preval  PrevalDef
	Use     interface{}
}

// PrevalDef specifies paren-preval options.
type PrevalDef struct {
	Active   bool
	Required bool
	Allow    []string
}

// ExprOptions configures the Expr plugin.
type ExprOptions struct {
	Op       map[string]*OpDef
	Evaluate func(rule *jsonic.Rule, ctx *jsonic.Context, op *Op, terms []interface{}) interface{}
}

// _unfilled is a sentinel value for pre-allocated but unfilled expression slots.
// Go slices don't have JS-like reference semantics for append, so we
// pre-allocate expression slices to their final length and fill slots
// as child results arrive.
var _unfilled interface{} = &struct{ x int }{-1}

func isUnfilled(v interface{}) bool { return v == _unfilled }

// isOp checks if a node is an expression (slice starting with *Op).
func isOp(node interface{}) bool {
	if sl, ok := node.([]interface{}); ok && len(sl) > 0 {
		_, isOp := sl[0].(*Op)
		return isOp
	}
	return false
}

// isExprOp checks if a node's op is an infix/prefix/suffix expression
// (not a ternary or paren, which are structural and shouldn't be drilled into).
func isExprOp(node interface{}) bool {
	if sl, ok := node.([]interface{}); ok && len(sl) > 0 {
		if op, ok := sl[0].(*Op); ok {
			return !op.Ternary && !op.Paren
		}
	}
	return false
}

// fillNextSlot walks the expression tree depth-first and fills
// the deepest unfilled (_unfilled sentinel) slot with val.
// Returns true if a slot was filled.
func fillNextSlot(node []interface{}, val interface{}) bool {
	if len(node) == 0 {
		return false
	}
	op, ok := node[0].(*Op)
	if !ok {
		return false
	}
	// Check children first (depth-first) to fill innermost incomplete expr.
	for i := 1; i <= op.Terms && i < len(node); i++ {
		if sub, ok := node[i].([]interface{}); ok && len(sub) > 0 {
			if _, subOp := sub[0].(*Op); subOp {
				if fillNextSlot(sub, val) {
					return true
				}
			}
		}
	}
	// Then check this node's own slots.
	for i := 1; i <= op.Terms && i < len(node); i++ {
		if isUnfilled(node[i]) {
			node[i] = val
			return true
		}
	}
	return false
}

// makeExpr creates a pre-allocated expression slice [op, term1, term2, ...]
// with unfilled slots marked by _unfilled sentinel.
func makeExpr(op *Op, terms ...interface{}) []interface{} {
	n := op.Terms + 1
	expr := make([]interface{}, n)
	expr[0] = op
	for i := 1; i < n; i++ {
		if i-1 < len(terms) {
			expr[i] = terms[i-1]
		} else {
			expr[i] = _unfilled
		}
	}
	return expr
}

// Expr is the expression parser plugin for jsonic.
func Expr(j *jsonic.Jsonic, opts map[string]interface{}) {
	eopts := resolveOptions(opts)
	allOps := makeAllOps(j, eopts)

	// Build lookup maps.
	infixByTin := make(map[int]*Op)
	prefixByTin := make(map[int]*Op)
	suffixByTin := make(map[int]*Op)
	parenOpenByTin := make(map[int]*Op)
	parenCloseByTin := make(map[int]*Op)
	ternaryByTin := make(map[int]*Op)
	ternaryCloseByTin := make(map[int]*Op)

	for _, op := range allOps {
		if op.Infix {
			infixByTin[op.Tin] = op
		}
		if op.Prefix {
			prefixByTin[op.Tin] = op
		}
		if op.Suffix {
			suffixByTin[op.Tin] = op
		}
		if op.Paren {
			parenOpenByTin[op.OTin] = op
			parenCloseByTin[op.CTin] = op
		}
		if op.Ternary {
			ternaryByTin[op.Tin] = op
			ternaryCloseByTin[op.CTin] = op
		}
	}

	collectTins := func(m map[int]*Op) []int {
		var tins []int
		for t := range m {
			tins = append(tins, t)
		}
		return tins
	}

	PREFIX := collectTins(prefixByTin)
	INFIX := collectTins(infixByTin)
	SUFFIX := collectTins(suffixByTin)
	OP := collectTins(parenOpenByTin)
	CP := collectTins(parenCloseByTin)
	TERN0 := collectTins(ternaryByTin)
	TERN1 := collectTins(ternaryCloseByTin)

	hasPrefix := len(PREFIX) > 0
	hasInfix := len(INFIX) > 0
	hasSuffix := len(SUFFIX) > 0
	hasParen := len(OP) > 0
	hasTernary := len(TERN0) > 0

	// Check if any paren op has preval active.
	hasPreval := false
	for _, op := range allOps {
		if op.Paren && op.Preval.Active {
			hasPreval = true
			break
		}
	}

	mkS := func(tins []int) [][]int { return [][]int{tins} }

	// === VAL rule modifications ===
	j.Rule("val", func(rs *jsonic.RuleSpec) {
		// Prefix operator: backtrack and push to 'expr'.
		if hasPrefix {
			rs.Open = append([]*jsonic.AltSpec{{
				S: mkS(PREFIX),
				B: 1,
				P: "expr",
				N: map[string]int{"expr_prefix": 1, "expr_suffix": 0},
				G: "expr,prefix",
			}}, rs.Open...)
		}

		// Preval: value followed by paren open (e.g., foo(1,2)).
		if hasPreval {
			valTinsLocal := j.TokenSet("VAL")
			rs.Open = append([]*jsonic.AltSpec{{
				S: [][]int{valTinsLocal, OP},
				B: 1,
				P: "expr",
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					pdef := parenOpenByTin[r.O1.Tin]
					if pdef == nil || !pdef.Preval.Active {
						return false
					}
					if len(pdef.Preval.Allow) > 0 {
						val, _ := r.O0.ResolveVal().(string)
						for _, a := range pdef.Preval.Allow {
							if a == val {
								return true
							}
						}
						return false
					}
					return true
				},
				U: map[string]interface{}{"paren_preval": true},
				A: func(r *jsonic.Rule, ctx *jsonic.Context) {
					r.Node = r.O0.ResolveVal()
				},
				G: "expr,paren,preval",
			}}, rs.Open...)
		}

		// Block pair detection when inside ternary and the colon
		// is a ternary close token (e.g., `1?2:3` — the `2:` should
		// NOT be treated as a key-value pair).
		if hasTernary {
			rs.Open = append([]*jsonic.AltSpec{{
				S: [][]int{j.TokenSet("VAL"), TERN1},
				B: 1,
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return r.N["expr_ternary"] > 0
				},
				G: "expr,ternary,block-pair",
			}}, rs.Open...)
		}

		// Paren open: backtrack and push to 'expr'.
		if hasParen {
			rs.Open = append([]*jsonic.AltSpec{{
				S: mkS(OP),
				B: 1,
				P: "expr",
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					pdef := parenOpenByTin[r.O0.Tin]
					return !pdef.Preval.Required
				},
				G: "expr,paren",
			}}, rs.Open...)
		}

		// Infix after value: backtrack, replace with 'expr' (only when NOT inside an expr).
		if hasInfix {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(INFIX),
				B: 1,
				N: map[string]int{"expr_prefix": 0, "expr_suffix": 0},
				RF: func(r *jsonic.Rule, ctx *jsonic.Context) string {
					if r.N["expr"] < 1 {
						return "expr"
					}
					return ""
				},
				G: "expr,infix",
			}}, rs.Close...)
		}

		// Suffix after value: backtrack, replace with 'expr' (only when NOT inside an expr).
		if hasSuffix {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(SUFFIX),
				B: 1,
				N: map[string]int{"expr_prefix": 0, "expr_suffix": 1},
				RF: func(r *jsonic.Rule, ctx *jsonic.Context) string {
					if r.N["expr"] < 1 {
						return "expr"
					}
					return ""
				},
				G: "expr,suffix",
			}}, rs.Close...)
		}

		// Ternary first separator.
		if hasTernary {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(TERN0),
				B: 1,
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return r.N["expr"] < 1
				},
				R: "ternary",
				G: "expr,ternary",
			}}, rs.Close...)

			// Ternary close: backtrack so ternary rule can consume it.
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(TERN1),
				B: 1,
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return r.N["expr_ternary"] > 0
				},
				G: "expr,ternary,close",
			}}, rs.Close...)
		}

		// Paren close propagation.
		if hasParen {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(CP),
				B: 1,
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return r.N["expr_paren"] > 0
				},
				G: "expr,paren-close",
			}}, rs.Close...)
		}

		// Prevent implicit list inside expression (comma).
		rs.Close = append([]*jsonic.AltSpec{{
			S: mkS([]int{jsonic.TinCA}),
			B: 1,
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return (r.D == 1 && (r.N["expr"] >= 1 || r.N["expr_ternary"] >= 1)) ||
					(r.N["expr_ternary"] >= 1 && r.N["expr_paren"] >= 1)
			},
			G: "expr,imp,comma",
		}}, rs.Close...)

		// Prevent implicit list inside expression (space).
		valTins := j.TokenSet("VAL")
		rs.Close = append([]*jsonic.AltSpec{{
			S: mkS(valTins),
			B: 1,
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return (r.D == 1 && (r.N["expr"] >= 1 || r.N["expr_ternary"] >= 1)) ||
					(r.N["expr_ternary"] >= 1 && r.N["expr_paren"] >= 1)
			},
			G: "expr,imp,space",
		}}, rs.Close...)
	})

	// === LIST rule modifications ===
	j.Rule("list", func(rs *jsonic.RuleSpec) {
		rs.BO = append(rs.BO, func(r *jsonic.Rule, ctx *jsonic.Context) {
			if r.Prev == nil || r.Prev == jsonic.NoRule || r.Prev.U["implist"] == nil {
				r.N["expr"] = 0
				r.N["expr_prefix"] = 0
				r.N["expr_suffix"] = 0
				r.N["expr_paren"] = 0
				r.N["expr_ternary"] = 0
			}
		})
		if hasParen {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(CP),
				BF: func(r *jsonic.Rule, ctx *jsonic.Context) int {
					if r.C0.Tin == jsonic.TinCS && r.N["expr_paren"] < 1 {
						return 0
					}
					return 1
				},
				G: "expr,paren,list",
			}}, rs.Close...)
			// Propagate implicit list node to enclosing paren.
			// Go slice append may reallocate, making paren.Child.Node
			// (which points to the original val) stale.
			rs.AC = append(rs.AC, func(r *jsonic.Rule, ctx *jsonic.Context) {
				if r.N["expr_paren"] > 0 && r.Parent != nil && r.Parent != jsonic.NoRule && r.Parent.Name == "paren" {
					r.Parent.Node = r.Node
				}
			})
		}
	})

	// === MAP rule modifications ===
	j.Rule("map", func(rs *jsonic.RuleSpec) {
		rs.BO = append(rs.BO, func(r *jsonic.Rule, ctx *jsonic.Context) {
			r.N["expr"] = 0
			r.N["expr_prefix"] = 0
			r.N["expr_suffix"] = 0
			r.N["expr_paren"] = 0
			r.N["expr_ternary"] = 0
		})
		if hasParen {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(CP),
				BF: func(r *jsonic.Rule, ctx *jsonic.Context) int {
					if r.C0.Tin == jsonic.TinCB && r.N["expr_paren"] < 1 {
						return 0
					}
					return 1
				},
				G: "expr,paren,map",
			}}, rs.Close...)
		}
	})

	// === PAIR rule modifications ===
	j.Rule("pair", func(rs *jsonic.RuleSpec) {
		if hasParen {
			rs.Close = append([]*jsonic.AltSpec{{
				S: mkS(CP),
				B: 1,
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return r.N["expr_paren"] > 0 || r.N["pk"] > 0
				},
				G: "expr,paren,pair",
			}}, rs.Close...)
		}
	})

	// === ELEM rule modifications ===
	j.Rule("elem", func(rs *jsonic.RuleSpec) {
		if hasParen {
			// Close implicit list within parens when ')' is seen.
			rs.Close = append([]*jsonic.AltSpec{
				{
					S: mkS(CP),
					B: 1,
					C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
						return r.N["expr_paren"] > 0
					},
					G: "expr,paren,elem,close",
				},
				// Following elem is a paren expression.
				{
					S: mkS(OP),
					B: 1,
					R: "elem",
					G: "expr,paren,elem,open",
				},
			}, rs.Close...)
			// Propagate elem node to enclosing paren after close.
			// Go slice append may reallocate, making earlier
			// references to the list stale.
			rs.AC = append(rs.AC, func(r *jsonic.Rule, ctx *jsonic.Context) {
				if r.N["expr_paren"] > 0 {
					// Walk parent chain to find paren rule.
					for p := r.Parent; p != nil && p != jsonic.NoRule; p = p.Parent {
						if p.Name == "paren" {
							p.Node = r.Node
							break
						}
					}
				}
			})
		}
	})

	// === EXPR rule ===
	exprSpec := &jsonic.RuleSpec{Name: "expr"}

	exprOpen := make([]*jsonic.AltSpec, 0)

	// Paren open inside expression: push to 'paren' rule (not 'val').
	// The 'paren' rule consumes '(' and pushes to 'val', breaking the
	// val→expr→val backtrack loop.
	if hasParen {
		exprOpen = append(exprOpen, &jsonic.AltSpec{
			S: mkS(OP),
			P: "paren",
			B: 1,
			G: "expr,paren,open",
		})
	}

	// Prefix operator.
	if hasPrefix {
		exprOpen = append(exprOpen, &jsonic.AltSpec{
			S: mkS(PREFIX),
			P: "val",
			N: map[string]int{"expr": 1, "dlist": 1, "dmap": 1},
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_prefix"] > 0
			},
			A: func(r *jsonic.Rule, ctx *jsonic.Context) {
				op := prefixByTin[r.O0.Tin]
				if isOp(r.Parent.Node) && isExprOp(r.Parent.Node) {
					r.Node = prattify(r.Parent.Node, op)
					r.Parent.Node = r.Node // sync after potential reallocation
				} else {
					r.Node = prior(r, r.Parent, op)
				}
			},
			G: "expr,prefix",
		})
	}

	// Infix operator.
	if hasInfix {
		exprOpen = append(exprOpen, &jsonic.AltSpec{
			S: mkS(INFIX),
			P: "val",
			N: map[string]int{"expr": 1, "expr_prefix": 0, "dlist": 1, "dmap": 1},
			A: func(r *jsonic.Rule, ctx *jsonic.Context) {
				op := infixByTin[r.O0.Tin]
				prev := r.Prev
				parent := r.Parent

				if isOp(parent.Node) && isExprOp(parent.Node) {
					r.Node = prattify(parent.Node, op)
					parent.Node = r.Node // sync after potential reallocation
				} else if isOp(prev.Node) {
					r.Node = prattify(prev.Node, op)
					r.Parent = prev
					prev.Node = r.Node // sync after potential reallocation
				} else {
					r.Node = prior(r, prev, op)
				}
			},
			G: "expr,infix",
		})
	}

	// Suffix operator.
	if hasSuffix {
		exprOpen = append(exprOpen, &jsonic.AltSpec{
			S: mkS(SUFFIX),
			N: map[string]int{"expr": 1, "expr_prefix": 0, "dlist": 1, "dmap": 1},
			A: func(r *jsonic.Rule, ctx *jsonic.Context) {
				op := suffixByTin[r.O0.Tin]
				prev := r.Prev
				if isOp(prev.Node) {
					r.Node = prattifySuffix(prev.Node, op)
				} else {
					r.Node = prior(r, prev, op)
				}
			},
			G: "expr,suffix",
		})
	}

	exprSpec.Open = exprOpen

	// expr.BC: attach child result to incomplete expression.
	// Uses fillNextSlot to find the deepest unfilled slot and fill it.
	// This avoids Go slice append issues and works with the Go parser's
	// replacement-chain result extraction.
	exprSpec.BC = []jsonic.StateAction{
		func(r *jsonic.Rule, ctx *jsonic.Context) {
			if r.Child == nil || r.Child == jsonic.NoRule {
				return
			}
			// Paren child: paren.AC already propagated the result.
			if r.Child.Name == "paren" {
				return
			}
			childNode := r.Child.Node
			if jsonic.IsUndefined(childNode) {
				childNode = nil
			}

			if sl, ok := r.Node.([]interface{}); ok && len(sl) > 0 {
				if _, isOpV := sl[0].(*Op); isOpV {
					fillNextSlot(sl, childNode)
				}
			}
		},
	}

	// expr.Close alternates.
	exprClose := make([]*jsonic.AltSpec, 0)

	// After paren child (paren rule completed).
	if hasParen {
		exprClose = append(exprClose, &jsonic.AltSpec{
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.Child != nil && r.Child != jsonic.NoRule && r.Child.Name == "paren"
			},
			N: map[string]int{"expr": 0},
			G: "expr,paren,end",
		})
	}

	// More infix (not during prefix).
	if hasInfix {
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(INFIX),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_prefix"] < 1
			},
			B: 1,
			R: "expr",
			G: "expr,infix,more",
		})
		// Infix seen during prefix: just end and backtrack.
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(INFIX),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_prefix"] > 0
			},
			B: 1,
			G: "expr,infix,prefix-end",
		})
	}

	// More suffix (not during prefix).
	if hasSuffix {
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(SUFFIX),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_prefix"] < 1
			},
			B: 1,
			R: "expr",
			G: "expr,suffix,more",
		})
	}

	// Paren close inside expression.
	if hasParen {
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(CP),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_paren"] > 0
			},
			B: 1,
			G: "expr,paren,close",
		})
	}

	// Ternary start.
	if hasTernary {
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(TERN0),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return r.N["expr_prefix"] < 1
			},
			B: 1,
			R: "ternary",
			G: "expr,ternary",
		})
	}

	// Implicit list at top level (comma).
	valTins := j.TokenSet("VAL")
	exprClose = append(exprClose, &jsonic.AltSpec{
		S: mkS([]int{jsonic.TinCA}),
		C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
			return r.D <= 0
		},
		N: map[string]int{"expr": 0},
		R: "elem",
		A: func(r *jsonic.Rule, ctx *jsonic.Context) {
			node := r.Node
			if isOp(node) {
				node = cleanExpr(node.([]interface{}))
			}
			r.Parent.Node = []interface{}{node}
			r.Node = r.Parent.Node
		},
		G: "expr,comma,list,top",
	})

	// Implicit list at top level (space).
	exprClose = append(exprClose, &jsonic.AltSpec{
		S: mkS(valTins),
		C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
			return r.D <= 0
		},
		N: map[string]int{"expr": 0},
		B: 1,
		R: "elem",
		A: func(r *jsonic.Rule, ctx *jsonic.Context) {
			node := r.Node
			if isOp(node) {
				node = cleanExpr(node.([]interface{}))
			}
			r.Parent.Node = []interface{}{node}
			r.Node = r.Parent.Node
		},
		G: "expr,space,list,top",
	})

	// Implicit list inside paren (comma).
	// When expr finishes inside a paren (expr_paren > 0) and sees a
	// comma, wrap the expression in a list on the paren node and
	// replace with elem to process subsequent items.
	implicitListAction := func(r *jsonic.Rule, ctx *jsonic.Context) {
		// Find enclosing paren rule in the stack.
		var paren *jsonic.Rule
		for rI := ctx.RSI - 1; rI >= 0; rI-- {
			if ctx.RS[rI].Name == "paren" {
				paren = ctx.RS[rI]
				break
			}
		}
		if paren == nil {
			return
		}
		node := r.Node
		if isOp(node) {
			node = cleanExpr(node.([]interface{}))
		}
		// If paren already has a list node, append to it.
		// Otherwise create a new list.
		if sl, ok := paren.Node.([]interface{}); ok && len(sl) > 0 {
			if _, isOpV := sl[0].(*Op); !isOpV {
				// It's a plain list, append.
				paren.Node = append(sl, node)
				r.Node = paren.Node
				return
			}
		}
		paren.Node = []interface{}{node}
		r.Node = paren.Node
	}
	if hasParen {
		// Only fire when there's no existing list/elem handling
		// the implicit list. Walk the parent chain to check if
		// there's an elem/list between this expr and the paren.
		isFirstImplicitInParen := func(r *jsonic.Rule) bool {
			if r.N["expr_paren"] < 1 || r.N["pk"] >= 1 {
				return false
			}
			for p := r.Parent; p != nil && p != jsonic.NoRule; p = p.Parent {
				if p.Name == "elem" || p.Name == "list" {
					return false // existing list machinery handles it
				}
				if p.Name == "paren" {
					return true // reached paren without finding elem/list
				}
			}
			return true
		}
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS([]int{jsonic.TinCA}),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return isFirstImplicitInParen(r)
			},
			N: map[string]int{"expr": 0, "expr_prefix": 0, "expr_suffix": 0},
			R: "elem",
			A: implicitListAction,
			G: "expr,paren,imp,comma",
		})
		exprClose = append(exprClose, &jsonic.AltSpec{
			S: mkS(valTins),
			C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
				return isFirstImplicitInParen(r) && r.N["expr_suffix"] < 1
			},
			N: map[string]int{"expr": 0, "expr_prefix": 0, "expr_suffix": 0},
			B: 1,
			R: "elem",
			A: implicitListAction,
			G: "expr,paren,imp,space",
		})
	}

	// Implicit list (comma, not top).
	exprClose = append(exprClose, &jsonic.AltSpec{
		S: mkS([]int{jsonic.TinCA}),
		C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
			return r.N["pk"] < 1
		},
		N: map[string]int{"expr": 0},
		B: 1,
		G: "expr,list,imp,comma",
	})

	// Implicit list (space, not top).
	exprClose = append(exprClose, &jsonic.AltSpec{
		C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
			return r.N["pk"] < 1 && r.N["expr_suffix"] < 1
		},
		N: map[string]int{"expr": 0},
		G: "expr,list,imp,space",
	})

	exprSpec.Close = exprClose

	// AC: propagate result and evaluate.
	exprSpec.AC = []jsonic.StateAction{
		// Propagate expr result to the val it replaced (r.Prev).
		// This ensures parent rules (elem, paren) see the expression
		// result via their Child.Node, not the stale pre-replacement value.
		func(r *jsonic.Rule, ctx *jsonic.Context) {
			if r.Prev != nil && r.Prev != jsonic.NoRule {
				r.Prev.Node = r.Node
			}
		},
		// Evaluate if evaluator provided.
		func(r *jsonic.Rule, ctx *jsonic.Context) {
			if eopts.Evaluate != nil {
				if isOp(r.Node) {
					r.Node = evaluation(r, ctx, r.Node, eopts.Evaluate)
					// Also update Prev to reflect evaluated result.
					if r.Prev != nil && r.Prev != jsonic.NoRule {
						r.Prev.Node = r.Node
					}
				}
			}
		},
	}

	j.RSM()["expr"] = exprSpec

	// === PAREN rule ===
	// Intermediary rule that consumes '(' and pushes to val.
	// This breaks the val→expr→val backtrack loop.
	if hasParen {
		parenSpec := &jsonic.RuleSpec{Name: "paren"}

		parenSpec.BO = []jsonic.StateAction{
			func(r *jsonic.Rule, ctx *jsonic.Context) {
				// Allow implicits inside parens.
				r.N["dmap"] = 0
				r.N["dlist"] = 0
				r.N["pk"] = 0
			},
		}

		parenSpec.Open = []*jsonic.AltSpec{
			// Empty parens: ()
			{
				S: func() [][]int { return [][]int{OP, CP} }(),
				B: 1,
				G: "expr,paren,empty",
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					oOp := parenOpenByTin[r.O0.Tin]
					cOp := parenCloseByTin[r.O1.Tin]
					return oOp != nil && cOp != nil && oOp.Name == cOp.Name
				},
				A: func(r *jsonic.Rule, ctx *jsonic.Context) {
					pop := parenOpenByTin[r.O0.Tin]
					pd := "expr_paren_depth_" + pop.Name
					r.U[pd] = 1
					r.N[pd] = 1
					r.Node = jsonic.Undefined
				},
			},
			// Normal paren open: consumes '(' and pushes to val.
			{
				S: mkS(OP),
				P: "val",
				N: map[string]int{
					"expr_paren":  1,
					"expr":        0,
					"expr_prefix": 0,
					"expr_suffix": 0,
				},
				G: "expr,paren,open",
				A: func(r *jsonic.Rule, ctx *jsonic.Context) {
					pop := parenOpenByTin[r.O0.Tin]
					pd := "expr_paren_depth_" + pop.Name
					r.U[pd] = 1
					r.N[pd] = 1
					r.Node = jsonic.Undefined
				},
			},
		}

		parenSpec.Close = []*jsonic.AltSpec{
			{
				S: mkS(CP),
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					cop := parenCloseByTin[r.C0.Tin]
					if cop == nil {
						return false
					}
					pd := "expr_paren_depth_" + cop.Name
					_, ok := r.N[pd]
					return ok && r.N[pd] > 0
				},
				A: func(r *jsonic.Rule, ctx *jsonic.Context) {
					// Construct completed paren expression.
					cop := parenCloseByTin[r.C0.Tin]
					pop := parenOpenByTin[cop.OTin]
					if pop == nil {
						// Lookup by matching name.
						for _, op := range allOps {
							if op.Paren && op.Name == cop.Name {
								pop = op
								break
							}
						}
					}
					if pop == nil {
						return
					}

					val := r.Node

					// Build paren expression node.
					result := []interface{}{pop}

					// Inject function name if preval is active.
					if r.Parent != nil && r.Parent != jsonic.NoRule &&
						r.Parent.Parent != nil && r.Parent.Parent != jsonic.NoRule &&
						r.Parent.Parent.U["paren_preval"] == true &&
						r.Parent.Parent.Node != nil {
						result = append(result, r.Parent.Parent.Node)
					}

					if !jsonic.IsUndefined(val) {
						result = append(result, val)
					}

					r.Node = result
				},
				G: "expr,paren,close",
			},
		}

		parenSpec.BC = []jsonic.StateAction{
			func(r *jsonic.Rule, ctx *jsonic.Context) {
				if r.Child == nil || r.Child == jsonic.NoRule {
					return
				}
				childNode := r.Child.Node
				if jsonic.IsUndefined(childNode) {
					return
				}
				if jsonic.IsUndefined(r.Node) {
					r.Node = childNode
				} else if isOp(childNode) {
					// Don't overwrite if paren.Node is already a plain list
					// (set by implicit list handling in elem/ternary).
					if !isOp(r.Node) {
						if sl, ok := r.Node.([]interface{}); ok && len(sl) > 0 {
							return // keep the implicit list
						}
					}
					r.Node = childNode
				}
			},
		}

		parenSpec.AC = []jsonic.StateAction{
			func(r *jsonic.Rule, ctx *jsonic.Context) {
				// Propagate paren result to parent.
				r.Parent.Node = r.Node
				if r.Parent.Parent != nil && r.Parent.Parent != jsonic.NoRule {
					r.Parent.Parent.Node = r.Node
				}
			},
		}

		j.RSM()["paren"] = parenSpec
	}

	// === TERNARY rule ===
	if hasTernary {
		ternarySpec := &jsonic.RuleSpec{Name: "ternary"}

		ternarySpec.Open = []*jsonic.AltSpec{
			{
				S: mkS(TERN0),
				P: "val",
				N: map[string]int{"expr_ternary": 1, "dlist": 1, "dmap": 1, "expr": 0, "expr_prefix": 0, "expr_suffix": 0},
				A: func(r *jsonic.Rule, ctx *jsonic.Context) {
					op := ternaryByTin[r.O0.Tin]
					prev := r.Prev
					prevNode := prev.Node
					if isOp(prevNode) {
						prevNode = dupExpr(prevNode.([]interface{}))
					}
					r.Node = makeExpr(op, prevNode) // [op, cond, _unfilled, _unfilled]
					prev.Node = r.Node
				},
				G: "expr,ternary,open",
			},
		}

		ternarySpec.BC = []jsonic.StateAction{
			func(r *jsonic.Rule, ctx *jsonic.Context) {
				if r.Child == nil || r.Child == jsonic.NoRule {
					return
				}
				childNode := r.Child.Node
				if jsonic.IsUndefined(childNode) {
					childNode = nil
				}
				if sl, ok := r.Node.([]interface{}); ok {
					step, _ := r.U["ternary_step"].(int)
					if step == 0 {
						fillNextSlot(sl, childNode)
						r.U["ternary_step"] = 1
					} else if step == 1 {
						fillNextSlot(sl, childNode)
						r.U["ternary_step"] = 2
					} else if step == 2 {
						// Final slot filled when ternary ends
						// (e.g., inside an existing elem/list).
						fillNextSlot(sl, childNode)
					}
				}
			},
		}

		// Condition for implicit list after ternary completes.
		// Only fire when ternary is the FIRST expression — i.e., not already
		// inside an elem/list that handles implicit list continuation.
		implicitTernaryCond := func(r *jsonic.Rule) bool {
			step, _ := r.U["ternary_step"].(int)
			if step != 2 || r.N["pk"] >= 1 {
				return false
			}
			if r.D == 0 {
				// Top-level: check no elem/list parent exists.
				for p := r.Parent; p != nil && p != jsonic.NoRule; p = p.Parent {
					if p.Name == "elem" || p.Name == "list" {
						return false
					}
				}
				return true
			}
			if r.N["expr_paren"] >= 1 {
				// Inside paren: check no elem/list between ternary and paren.
				for p := r.Parent; p != nil && p != jsonic.NoRule; p = p.Parent {
					if p.Name == "elem" || p.Name == "list" {
						return false
					}
					if p.Name == "paren" {
						return true
					}
				}
				return true
			}
			return false
		}

		// Action to wrap ternary result as first element of implicit list.
		implicitTernaryAction := func(r *jsonic.Rule, ctx *jsonic.Context) {
			// Fill the last slot with child node.
			if r.Child != nil && r.Child != jsonic.NoRule {
				childNode := r.Child.Node
				if jsonic.IsUndefined(childNode) {
					childNode = nil
				}
				if sl, ok := r.Node.([]interface{}); ok {
					fillNextSlot(sl, childNode)
				}
			}
			// Wrap the completed ternary node as the first element of a list.
			ternaryNode := r.Node
			if isOp(ternaryNode) {
				ternaryNode = cleanExpr(ternaryNode.([]interface{}))
			}
			listNode := []interface{}{ternaryNode}

			// If inside a paren, store the list on paren.Node directly
			// (same approach as implicitListAction for expr).
			if r.N["expr_paren"] >= 1 {
				for rI := ctx.RSI - 1; rI >= 0; rI-- {
					if ctx.RS[rI].Name == "paren" {
						ctx.RS[rI].Node = listNode
						break
					}
				}
			}
			r.Node = listNode
		}

		ternarySpec.Close = []*jsonic.AltSpec{
			// Second separator (e.g. ':').
			{
				S: mkS(TERN1),
				P: "val",
				N: map[string]int{"expr": 0, "expr_prefix": 0, "expr_suffix": 0},
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					step, _ := r.U["ternary_step"].(int)
					return step == 1
				},
				G: "expr,ternary,sep2",
			},

			// Implicit list after ternary (comma): 1?2:3,b → [[?,1,2,3],"b"]
			{
				S: mkS([]int{jsonic.TinCA}),
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return implicitTernaryCond(r)
				},
				R: "elem",
				A: implicitTernaryAction,
				G: "expr,ternary,list,imp,comma",
			},

			// Paren close after ternary: backtrack so paren can consume it.
			{
				S: mkS(CP),
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					step, _ := r.U["ternary_step"].(int)
					return step == 2 && r.N["expr_paren"] >= 1
				},
				B: 1,
				G: "expr,ternary,paren,close",
			},

			// Implicit list after ternary (space): 1?2:3 b → [[?,1,2,3],"b"]
			{
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					return implicitTernaryCond(r) && ctx.T0.Tin != jsonic.TinZZ
				},
				R: "elem",
				A: implicitTernaryAction,
				G: "expr,ternary,list,imp,space",
			},

			// End of ternary (deeper depth, or no more tokens).
			{
				C: func(r *jsonic.Rule, ctx *jsonic.Context) bool {
					step, _ := r.U["ternary_step"].(int)
					return step == 2
				},
				G: "expr,ternary,end",
			},
		}

		ternarySpec.AC = []jsonic.StateAction{
			func(r *jsonic.Rule, ctx *jsonic.Context) {
				if eopts.Evaluate != nil {
					if isOp(r.Node) {
						r.Node = evaluation(r, ctx, r.Node, eopts.Evaluate)
					}
				}
			},
		}

		j.RSM()["ternary"] = ternarySpec
	}
}

// prior converts a prior rule's node into the start of a new expression.
// Uses pre-allocated expression slices with unfilled sentinel slots.
func prior(rule *jsonic.Rule, priorRule *jsonic.Rule, op *Op) []interface{} {
	priorNode := priorRule.Node
	if isOp(priorNode) {
		priorNode = dupExpr(priorNode.([]interface{}))
	}

	var expr []interface{}
	if op.Prefix {
		expr = makeExpr(op) // [op, _unfilled]
	} else {
		expr = makeExpr(op, priorNode) // [op, priorNode, _unfilled]
	}
	priorRule.Node = expr
	rule.Parent = priorRule
	return expr
}

// prattify integrates a new operator into the expression tree
// according to operator precedence (Pratt algorithm).
// Always returns the outermost expression (for Go parser compatibility).
func prattify(exprNode interface{}, op *Op) []interface{} {
	expr, ok := exprNode.([]interface{})
	if !ok || len(expr) == 0 {
		return makeExpr(op, exprNode)
	}

	exprOp, isOpV := expr[0].(*Op)
	if !isOpV {
		return makeExpr(op, exprNode)
	}

	// Paren expressions are complete units — never drill into them.
	if exprOp.Paren {
		return makeExpr(op, dupExpr(expr))
	}

	if op.Infix {
		// op is lower or equal precedence: wrap entire expression.
		if exprOp.Suffix || op.Left <= exprOp.Right {
			return wrapExpr(expr, op)
		}

		// op is higher: drill into last term. Create inner expression.
		end := exprOp.Terms
		if end < len(expr) {
			if isOp(expr[end]) {
				subExpr := expr[end].([]interface{})
				subOp := subExpr[0].(*Op)
				if subOp.Right < op.Left {
					expr[end] = prattify(subExpr, op)
					return expr
				}
			}
			// Create pre-allocated inner expression with old value as first term.
			expr[end] = makeExpr(op, expr[end])
			return expr
		}
		return expr
	}

	if op.Prefix {
		end := exprOp.Terms
		if end < len(expr) {
			expr[end] = makeExpr(op) // [op, _unfilled]
			return expr
		}
		return expr
	}

	if op.Suffix {
		return prattifySuffix(exprNode, op)
	}

	return expr
}

// wrapExpr wraps an existing expression with a new operator.
// Reuses the slice in-place: [new_op, dup(old), _unfilled, ...]
func wrapExpr(expr []interface{}, op *Op) []interface{} {
	oldCopy := dupExpr(expr)
	needed := op.Terms + 1
	// Ensure slice is long enough.
	for len(expr) < needed {
		expr = append(expr, _unfilled)
	}
	expr[0] = op
	expr[1] = oldCopy
	// Clear remaining slots and truncate extras.
	for i := 2; i < needed; i++ {
		expr[i] = _unfilled
	}
	if len(expr) > needed {
		// Clear excess slots to avoid stale data.
		for i := needed; i < len(expr); i++ {
			expr[i] = nil
		}
		expr = expr[:needed]
	}
	return expr
}

// prattifySuffix integrates a suffix operator into the expression tree.
func prattifySuffix(node interface{}, op *Op) []interface{} {
	expr, ok := node.([]interface{})
	if !ok {
		return makeExpr(op, node)
	}

	exprOp, isOpV := expr[0].(*Op)
	if !isOpV {
		return makeExpr(op, node)
	}

	if !exprOp.Suffix && exprOp.Right <= op.Left {
		end := exprOp.Terms
		if end < len(expr) {
			lastTerm := expr[end]
			// Drill into prefix.
			if subExpr, ok := lastTerm.([]interface{}); ok && len(subExpr) > 0 {
				if subOp, isSub := subExpr[0].(*Op); isSub && subOp.Prefix && subOp.Right < op.Left {
					prattifySuffix(subExpr, op)
					return expr
				}
			}
			expr[end] = makeExpr(op, lastTerm)
			return expr
		}
	}

	// Wrap entire expression.
	return wrapExpr(expr, op)
}

// cleanExpr removes _unfilled sentinels from an expression tree.
func cleanExpr(expr []interface{}) []interface{} {
	out := make([]interface{}, 0, len(expr))
	for _, el := range expr {
		if isUnfilled(el) {
			continue
		}
		if sub, ok := el.([]interface{}); ok && isOp(sub) {
			out = append(out, cleanExpr(sub))
		} else {
			out = append(out, el)
		}
	}
	return out
}

func dupExpr(expr []interface{}) []interface{} {
	out := make([]interface{}, len(expr))
	copy(out, expr)
	return out
}

// Parse is a convenience function.
func Parse(src string, opts ...map[string]interface{}) (interface{}, error) {
	j := MakeJsonic(opts...)
	return j.Parse(src)
}

// MakeJsonic creates a jsonic instance configured with the Expr plugin.
func MakeJsonic(opts ...map[string]interface{}) *jsonic.Jsonic {
	j := jsonic.Make()
	var pluginOpts map[string]interface{}
	if len(opts) > 0 {
		pluginOpts = opts[0]
	}
	j.Use(Expr, pluginOpts)
	return j
}

func resolveOptions(opts map[string]interface{}) *ExprOptions {
	eopts := &ExprOptions{Op: make(map[string]*OpDef)}
	if opts == nil {
		addDefaultOps(eopts)
		return eopts
	}
	if opRaw, ok := opts["op"]; ok {
		if opMap, ok := opRaw.(map[string]interface{}); ok {
			for name, defRaw := range opMap {
				if defRaw == nil {
					eopts.Op[name] = nil
					continue
				}
				if defMap, ok := defRaw.(map[string]interface{}); ok {
					od := &OpDef{}
					if v, ok := defMap["src"]; ok {
						od.Src = v
					}
					if v, ok := defMap["osrc"].(string); ok {
						od.OSrc = v
					}
					if v, ok := defMap["csrc"].(string); ok {
						od.CSrc = v
					}
					if v, ok := defMap["left"].(float64); ok {
						od.Left = int(v)
					} else if v, ok := defMap["left"].(int); ok {
						od.Left = v
					}
					if v, ok := defMap["right"].(float64); ok {
						od.Right = int(v)
					} else if v, ok := defMap["right"].(int); ok {
						od.Right = v
					}
					if v, ok := defMap["prefix"].(bool); ok {
						od.Prefix = v
					}
					if v, ok := defMap["suffix"].(bool); ok {
						od.Suffix = v
					}
					if v, ok := defMap["infix"].(bool); ok {
						od.Infix = v
					}
					if v, ok := defMap["ternary"].(bool); ok {
						od.Ternary = v
					}
					if v, ok := defMap["paren"].(bool); ok {
						od.Paren = v
					}
					if v, ok := defMap["preval"]; ok {
						od.Preval = v
					}
					if v, ok := defMap["use"]; ok {
						od.Use = v
					}
					eopts.Op[name] = od
				}
			}
		}
	}
	if evalRaw, ok := opts["evaluate"]; ok {
		if evalFn, ok := evalRaw.(func(*jsonic.Rule, *jsonic.Context, *Op, []interface{}) interface{}); ok {
			eopts.Evaluate = evalFn
		}
	}
	addDefaultOps(eopts)
	return eopts
}

func addDefaultOps(eopts *ExprOptions) {
	defaults := map[string]*OpDef{
		"positive":       {Prefix: true, Right: 14000, Src: "+"},
		"negative":       {Prefix: true, Right: 14000, Src: "-"},
		"addition":       {Infix: true, Left: 140, Right: 150, Src: "+"},
		"subtraction":    {Infix: true, Left: 140, Right: 150, Src: "-"},
		"multiplication": {Infix: true, Left: 160, Right: 170, Src: "*"},
		"division":       {Infix: true, Left: 160, Right: 170, Src: "/"},
		"remainder":      {Infix: true, Left: 160, Right: 170, Src: "%"},
		"plain":          {Paren: true, OSrc: "(", CSrc: ")"},
	}
	for name, def := range defaults {
		if _, exists := eopts.Op[name]; !exists {
			eopts.Op[name] = def
		}
	}
}

func makeAllOps(j *jsonic.Jsonic, eopts *ExprOptions) []*Op {
	// Track registered tins by source string to share between operators
	// (e.g., "+" is both prefix "positive" and infix "addition").
	// FixedTokens is a map[string]Tin, so only one tin per source string.
	srcTins := make(map[string]int) // src → tin

	getOrCreateTin := func(name, src string) int {
		if src == "" {
			return j.Token(name)
		}
		if tin, ok := srcTins[src]; ok {
			return tin
		}
		// Reuse existing fixed token tin if src matches a built-in token
		// (e.g., ":" is TinCL, "[" is TinOS). This prevents overriding
		// jsonic's built-in token types when operators share syntax.
		if existingTin, ok := jsonic.FixedTokens[src]; ok {
			srcTins[src] = int(existingTin)
			return int(existingTin)
		}
		tin := j.Token(name, src)
		srcTins[src] = tin
		return tin
	}

	var ops []*Op
	for name, def := range eopts.Op {
		if def == nil {
			continue
		}
		op := &Op{
			Name: name, Left: def.Left, Right: def.Right,
			Prefix: def.Prefix, Suffix: def.Suffix, Infix: def.Infix,
			Ternary: def.Ternary, Paren: def.Paren, Use: def.Use,
		}
		if def.Infix {
			op.Terms = 2
		} else if def.Ternary {
			op.Terms = 3
		} else {
			op.Terms = 1
		}
		if def.Paren {
			op.OSrc = def.OSrc
			op.CSrc = def.CSrc
			op.Name = name + "-paren"
			op.OTkn = "#E_" + name + "_o"
			op.CTkn = "#E_" + name + "_c"
			op.OTin = getOrCreateTin(op.OTkn, op.OSrc)
			op.CTin = getOrCreateTin(op.CTkn, op.CSrc)
			if def.Preval != nil {
				switch pv := def.Preval.(type) {
				case bool:
					op.Preval.Active = pv
				case map[string]interface{}:
					if v, ok := pv["active"].(bool); ok {
						op.Preval.Active = v
					} else {
						// Default: active=true when preval object is specified
						op.Preval.Active = true
					}
					if v, ok := pv["required"].(bool); ok {
						op.Preval.Required = v
					}
					if v, ok := pv["allow"].([]interface{}); ok {
						for _, a := range v {
							if s, ok := a.(string); ok {
								op.Preval.Allow = append(op.Preval.Allow, s)
							}
						}
					}
					if v, ok := pv["allow"].([]string); ok {
						op.Preval.Allow = v
					}
				case PrevalDef:
					op.Preval = pv
				}
			}
		} else if def.Ternary {
			op.Name = name + "-ternary"
			if src, ok := def.Src.([]interface{}); ok && len(src) >= 2 {
				op.Src = src[0].(string)
				op.CSrc = src[1].(string)
			}
			op.Tkn = "#E_" + name
			op.Tin = getOrCreateTin(op.Tkn, op.Src)
			op.CTkn = "#E_" + name + "_c"
			op.CTin = getOrCreateTin(op.CTkn, op.CSrc)
		} else {
			srcStr := ""
			if s, ok := def.Src.(string); ok {
				srcStr = s
			}
			op.Src = srcStr
			kind := "infix"
			if def.Prefix {
				kind = "prefix"
			} else if def.Suffix {
				kind = "suffix"
			}
			op.Name = name + "-" + kind
			op.Tkn = "#E_" + name
			op.Tin = getOrCreateTin(op.Tkn, srcStr)
		}
		ops = append(ops, op)
	}
	return ops
}

// Evaluation recursively evaluates an expression tree.
func Evaluation(
	rule *jsonic.Rule, ctx *jsonic.Context, node interface{},
	resolve func(*jsonic.Rule, *jsonic.Context, *Op, []interface{}) interface{},
) interface{} {
	return evaluation(rule, ctx, node, resolve)
}

func evaluation(
	rule *jsonic.Rule, ctx *jsonic.Context, node interface{},
	resolve func(*jsonic.Rule, *jsonic.Context, *Op, []interface{}) interface{},
) interface{} {
	expr, isSlice := node.([]interface{})
	if !isSlice || len(expr) == 0 {
		return node
	}
	op, isOpV := expr[0].(*Op)
	if !isOpV {
		result := make([]interface{}, len(expr))
		for i, el := range expr {
			result[i] = evaluation(rule, ctx, el, resolve)
		}
		return result
	}
	terms := make([]interface{}, 0, len(expr)-1)
	for _, sub := range expr[1:] {
		if isUnfilled(sub) {
			continue
		}
		terms = append(terms, evaluation(rule, ctx, sub, resolve))
	}
	return resolve(rule, ctx, op, terms)
}

// Simplify converts an expression tree with *Op nodes into plain
// arrays/maps with string operator names.
func Simplify(node interface{}) interface{} {
	switch v := node.(type) {
	case []interface{}:
		if len(v) == 0 {
			return v
		}
		if op, isOpV := v[0].(*Op); isOpV {
			result := make([]interface{}, 0, len(v))
			src := op.Src
			if op.Paren {
				src = op.OSrc
			}
			result = append(result, src)
			for _, el := range v[1:] {
				if isUnfilled(el) {
					continue
				}
				s := Simplify(el)
				if s != nil {
					result = append(result, s)
				}
			}
			return result
		}
		result := make([]interface{}, len(v))
		for i, el := range v {
			result[i] = Simplify(el)
		}
		return result
	case map[string]interface{}:
		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = Simplify(val)
		}
		return result
	default:
		return node
	}
}
