def register(ctx) -> None:
    ctx.register_auxiliary_task(
        "approvals_review",
        display_name="Approvals review",
        description="Reads each pending memory/skill write against your rules before you can approve it.",
        defaults={"timeout": 300},
    )
    ctx.register_auxiliary_task(
        "approvals_test",
        display_name="Approvals side-by-side test",
        description="Answers a skill's test tasks with its old and its new text when you press Test on a card. "
                    "Leave it on auto to test with your main model.",
        defaults={"timeout": 300},
    )
