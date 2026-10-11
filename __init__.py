def register(ctx) -> None:
    ctx.register_auxiliary_task(
        "approvals_review",
        display_name="Approvals review",
        description="Reads each pending memory/skill write against your rules before you can approve it.",
        defaults={"timeout": 300},
    )
