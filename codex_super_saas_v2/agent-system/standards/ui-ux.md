# UI / UX Standard

Derived from the reusable UX and interface rules supplied by the user.

## Visual quality
- Clear visual hierarchy.
- Predictable and consistent component behavior.
- Reuse the existing design system/tokens before inventing new primitives.
- Action labels must describe the action.
- Critical information stays visible; secondary detail can be progressive.
- Every user action gets immediate feedback.

## States
For affected interactive/data UI, handle applicable:
- loading
- empty
- error
- success
- disabled

Use skeleton/progress patterns instead of unexplained blank states where appropriate.

## Responsive/accessibility
- Desktop, tablet and mobile behavior must remain usable.
- Critical actions must remain executable on small screens.
- Do not rely only on color to communicate state.
- Preserve keyboard accessibility and readable contrast.

## Visual task rule
When the request is aesthetic, optimize layout, spacing, typography, cards, buttons, charts, surfaces and responsiveness WITHOUT changing business logic.

## Dashboards
When the project specifically adopts the supplied Decision System, consult its source rule for metric/graph/action requirements. Do not globally force dashboard-specific rules onto unrelated SaaS screens.
